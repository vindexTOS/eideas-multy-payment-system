import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { PaginatedResult } from '../../shared/dto/paginated-result.dto';
import { PaymentSource } from '../../shared/enums/payment-source.enum';
import { PaymentStatus } from '../../shared/enums/payment-status.enum';
import { UserRole } from '../../shared/enums/user-role.enum';
import { AuthenticatedUser } from '../../shared/interfaces/authenticated-user.interface';
import { AccessScopeService } from '../../shared/services/access-scope.service';
import { CommissionService } from '../../shared/services/commission.service';
import { toNumericString } from '../../shared/utils/money.util';
import { DeviceAssignmentService } from '../access/device-assignment.service';
import { Device } from '../devices/entities/device.entity';
import { DevicesService } from '../devices/devices.service';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { Payment } from './entities/payment.entity';

export interface RecordPaymentInput {
  /** Either the hardware uid (MQTT path) or the internal id (API path). */
  deviceUid?: string;
  deviceId?: string;
  amount: number | string;
  paidAt?: Date;
  source?: PaymentSource;
  status?: PaymentStatus;
  externalRef?: string | null;
  userId?: string | null;
  raw?: Record<string, unknown> | null;
  currency?: string;
}

const UNIQUE_VIOLATION = '23505';

/**
 * Write side of the money model.
 *
 * Two inbound paths, one table:
 *  1. terminal payment      -> straight into that device earnings
 *  2. app balance spend     -> wallet module calls in with source=app_balance
 *
 * The commission is computed once, here, and stored on the row. Earnings
 * reporting then never has to know the tariff rules at all.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly payments: Repository<Payment>,
    private readonly devices: DevicesService,
    private readonly commission: CommissionService,
    private readonly assignments: DeviceAssignmentService,
    private readonly accessScope: AccessScopeService,
  ) {}

  /**
   * The single entry point for money coming in. Idempotent on `externalRef`:
   * MQTT qos 1 is at-least-once, so a redelivered frame must not be counted
   * twice.
   */
  async record(input: RecordPaymentInput): Promise<Payment> {
    const device = await this.resolveDevice(input);
    const paidAt = input.paidAt ?? new Date();

    const calc = this.commission.calculate({
      amount: input.amount,
      minTariff: device.minTariff,
      percentTariff: device.percentTariff,
    });

    const payment = this.payments.create({
      deviceId: device.id,
      companyId: device.companyId,
      siteId: device.siteId,
      amount: toNumericString(calc.amount),
      commission: toNumericString(calc.commission),
      netAmount: toNumericString(calc.netAmount),
      appliedRule: calc.appliedRule,
      currency: input.currency ?? 'GEL',
      source: input.source ?? PaymentSource.TERMINAL,
      status: input.status ?? PaymentStatus.SUCCESS,
      externalRef: input.externalRef ?? null,
      userId: input.userId ?? null,
      paidAt,
      raw: input.raw ?? null,
    });

    try {
      const saved = await this.payments.save(payment);
      await this.devices.markSeen(device.id, paidAt);
      this.logger.log(
        `Payment ${saved.id}: ${saved.amount} on ${device.deviceUid} (commission ${saved.commission}, ${calc.appliedRule})`,
      );
      return saved;
    } catch (error) {
      const existing = await this.findDuplicate(error, input.externalRef);
      if (existing) {
        this.logger.warn(`Duplicate payment ref ${input.externalRef} ignored`);
        return existing;
      }
      throw error;
    }
  }

  async createManual(user: AuthenticatedUser, dto: RecordPaymentDto): Promise<Payment> {
    // Reuses the normal scope check, so a company cannot post to a device
    // it does not own.
    await this.devices.findOneScoped(user, dto.deviceId);
    return this.record({
      deviceId: dto.deviceId,
      amount: dto.amount,
      paidAt: dto.paidAt ? new Date(dto.paidAt) : undefined,
      source: dto.source ?? PaymentSource.MANUAL,
      externalRef: dto.externalRef ?? null,
      userId: dto.userId ?? null,
      raw: { enteredBy: user.id, enteredAt: new Date().toISOString() },
    });
  }

  async list(
    user: AuthenticatedUser,
    query: ListPaymentsQueryDto,
  ): Promise<PaginatedResult<Payment>> {
    const qb = this.payments
      .createQueryBuilder('payment')
      .leftJoin('payment.device', 'device')
      .addSelect(['device.id', 'device.name', 'device.deviceUid'])
      .skip(query.skip)
      .take(query.limit)
      .orderBy('payment.paidAt', query.sortOrder ?? 'DESC');

    const companyFilter = this.accessScope.companyFilter(user);
    if (companyFilter) {
      qb.andWhere('payment.companyId = :companyFilter', { companyFilter });
    } else if (query.companyId) {
      qb.andWhere('payment.companyId = :companyId', { companyId: query.companyId });
    }

    if (user.role === UserRole.MANAGER) {
      const allowed = await this.assignments.deviceIdsForUser(user.id);
      if (!allowed.length) return new PaginatedResult<Payment>([], 0, query.page, query.limit);
      qb.andWhere('payment.deviceId IN (:...allowed)', { allowed });
    }

    if (query.deviceId) qb.andWhere('payment.deviceId = :deviceId', { deviceId: query.deviceId });
    if (query.siteId) qb.andWhere('payment.siteId = :siteId', { siteId: query.siteId });
    if (query.status) qb.andWhere('payment.status = :status', { status: query.status });
    if (query.source) qb.andWhere('payment.source = :source', { source: query.source });
    if (query.paidFrom) qb.andWhere('payment.paidAt >= :paidFrom', { paidFrom: query.paidFrom });
    if (query.paidTo) qb.andWhere('payment.paidAt <= :paidTo', { paidTo: query.paidTo });

    const [items, total] = await qb.getManyAndCount();
    return new PaginatedResult(items, total, query.page, query.limit);
  }

  async findOneScoped(user: AuthenticatedUser, id: string): Promise<Payment> {
    const payment = await this.payments.findOne({
      where: { id },
      relations: { device: true },
    });
    if (!payment) throw new NotFoundException(`Payment ${id} not found`);
    this.accessScope.assertCompanyAccess(user, payment.companyId);
    return payment;
  }

  /**
   * Reversal keeps the row and flips its status, so earnings drop it (they
   * only sum SUCCESS) while the audit trail stays intact.
   */
  async reverse(id: string): Promise<Payment> {
    const payment = await this.payments.findOne({ where: { id } });
    if (!payment) throw new NotFoundException(`Payment ${id} not found`);
    payment.status = PaymentStatus.REVERSED;
    return this.payments.save(payment);
  }

  private async resolveDevice(input: RecordPaymentInput): Promise<Device> {
    if (input.deviceId) return this.devices.findById(input.deviceId);
    if (input.deviceUid) {
      const device = await this.devices.findByUid(input.deviceUid);
      if (!device) throw new NotFoundException(`Device uid ${input.deviceUid} is not registered`);
      return device;
    }
    throw new NotFoundException('Either deviceId or deviceUid is required');
  }

  /** Turn a unique-violation on external_ref into "already recorded". */
  private async findDuplicate(
    error: unknown,
    externalRef?: string | null,
  ): Promise<Payment | null> {
    if (!externalRef) return null;
    const code = (error as QueryFailedError & { code?: string })?.code;
    if (!(error instanceof QueryFailedError) || code !== UNIQUE_VIOLATION) return null;
    return this.payments.findOne({ where: { externalRef } });
  }
}

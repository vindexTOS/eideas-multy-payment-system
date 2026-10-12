import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginatedResult } from '../../shared/dto/paginated-result.dto';
import { UserRole } from '../../shared/enums/user-role.enum';
import { AuthenticatedUser } from '../../shared/interfaces/authenticated-user.interface';
import { AccessScopeService } from '../../shared/services/access-scope.service';
import { toAmount } from '../../shared/utils/money.util';
import { DeviceAssignmentService } from '../access/device-assignment.service';
import { CompaniesService } from '../companies/companies.service';
import { DeviceRegistryService } from '../device-registry/device-registry.service';
import { EarningsService } from '../earnings/earnings.service';
import { SitesService } from '../sites/sites.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { DeviceSummaryDto } from './dto/device-summary.dto';
import { ListDevicesQueryDto } from './dto/list-devices-query.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { Device } from './entities/device.entity';

const SORTABLE: Record<string, string> = {
  name: 'device.name',
  deviceUid: 'device.deviceUid',
  lastSeenAt: 'device.lastSeenAt',
  createdAt: 'device.createdAt',
};

/** Terminals: the unit money is attributed to, and the unit tariffs live on. */
@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name);

  constructor(
    @InjectRepository(Device)
    private readonly devices: Repository<Device>,
    private readonly companies: CompaniesService,
    private readonly sites: SitesService,
    private readonly registry: DeviceRegistryService,
    private readonly earnings: EarningsService,
    private readonly assignments: DeviceAssignmentService,
    private readonly accessScope: AccessScopeService,
  ) {}

  async list(
    user: AuthenticatedUser,
    query: ListDevicesQueryDto,
  ): Promise<PaginatedResult<DeviceSummaryDto>> {
    const qb = this.devices
      .createQueryBuilder('device')
      .leftJoin('device.company', 'company')
      .addSelect(['company.id', 'company.name'])
      .leftJoin('device.site', 'site')
      .addSelect(['site.id', 'site.name'])
      .skip(query.skip)
      .take(query.limit);

    const companyFilter = this.accessScope.companyFilter(user);
    if (companyFilter) {
      qb.andWhere('device.companyId = :companyFilter', { companyFilter });
    } else if (query.companyId) {
      qb.andWhere('device.companyId = :companyId', { companyId: query.companyId });
    }

    if (user.role === UserRole.MANAGER) {
      const allowed = await this.assignments.deviceIdsForUser(user.id);
      if (!allowed.length) {
        return new PaginatedResult<DeviceSummaryDto>([], 0, query.page, query.limit);
      }
      qb.andWhere('device.id IN (:...allowed)', { allowed });
    }

    if (query.siteId) qb.andWhere('device.siteId = :siteId', { siteId: query.siteId });
    if (query.type) qb.andWhere('device.type = :type', { type: query.type });
    if (query.status) qb.andWhere('device.status = :status', { status: query.status });
    if (query.search) {
      qb.andWhere(
        '(device.name ILIKE :search OR device.deviceUid ILIKE :search OR device.number ILIKE :search OR device.address ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }
    qb.orderBy(SORTABLE[query.sortBy ?? 'createdAt'] ?? SORTABLE.createdAt, query.sortOrder);

    const [rows, total] = await qb.getManyAndCount();
    const money = await this.earnings.totalsByDevice(
      rows.map((r) => r.id),
      { months: 1 },
    );

    const items = rows.map<DeviceSummaryDto>((row) => {
      const totals = money.get(row.id);
      return {
        id: row.id,
        deviceUid: row.deviceUid,
        name: row.name,
        type: row.type,
        typeLabel: row.typeLabel,
        status: row.status,
        number: row.number,
        address: row.address ?? row.site?.address ?? null,
        minTariff: toAmount(row.minTariff),
        percentTariff: toAmount(row.percentTariff),
        companyId: row.companyId,
        companyName: row.company?.name,
        siteId: row.siteId,
        siteName: row.site?.name ?? null,
        lastSeenAt: row.lastSeenAt,
        monthEarnings: totals?.total ?? 0,
        monthCommission: totals?.commission ?? 0,
        monthNet: totals?.net ?? 0,
        createdAt: row.createdAt,
      };
    });

    return new PaginatedResult(items, total, query.page, query.limit);
  }

  /** Read one device with the caller scope enforced (company + manager). */
  async findOneScoped(user: AuthenticatedUser, id: string): Promise<Device> {
    const device = await this.devices.findOne({
      where: { id },
      relations: { company: true, site: true },
    });
    if (!device) throw new NotFoundException(`Device ${id} not found`);
    this.accessScope.assertCompanyAccess(user, device.companyId);

    if (user.role === UserRole.MANAGER && !(await this.assignments.hasAccess(user.id, device.id))) {
      throw new NotFoundException(`Device ${id} not found`);
    }
    return device;
  }

  async findById(id: string): Promise<Device> {
    const device = await this.devices.findOne({ where: { id } });
    if (!device) throw new NotFoundException(`Device ${id} not found`);
    return device;
  }

  /** Resolution path for inbound MQTT frames. */
  findByUid(deviceUid: string): Promise<Device | null> {
    return this.devices.findOne({ where: { deviceUid } });
  }

  /** Used when assigning devices to a manager: they must be the same company. */
  async idsForCompany(companyId: string): Promise<string[]> {
    const rows = await this.devices.find({ where: { companyId }, select: { id: true } });
    return rows.map((r) => r.id);
  }

  async create(user: AuthenticatedUser, dto: CreateDeviceDto): Promise<Device> {
    const companyId = this.accessScope.resolveWriteCompanyId(user, dto.companyId);
    await this.companies.assertExists(companyId);

    if (await this.devices.countBy({ deviceUid: dto.deviceUid })) {
      throw new ConflictException(`Device uid ${dto.deviceUid} is already registered`);
    }
    if (dto.siteId) await this.assertSiteBelongsToCompany(dto.siteId, companyId);

    const device = this.devices.create({
      ...dto,
      companyId,
      siteId: dto.siteId ?? null,
      minTariff: dto.minTariff.toFixed(2),
      percentTariff: dto.percentTariff.toFixed(2),
      latitude: dto.latitude?.toString() ?? null,
      longitude: dto.longitude?.toString() ?? null,
    });
    const saved = await this.devices.save(device);

    // It is a known device now, so it leaves the unregistered pool.
    await this.registry.claim(saved.deviceUid);
    this.logger.log(`Registered device ${saved.deviceUid} for company ${companyId}`);
    return saved;
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateDeviceDto): Promise<Device> {
    const device = await this.findOneScoped(user, id);
    if (dto.siteId) await this.assertSiteBelongsToCompany(dto.siteId, device.companyId);

    Object.assign(device, {
      ...dto,
      minTariff: dto.minTariff !== undefined ? dto.minTariff.toFixed(2) : device.minTariff,
      percentTariff:
        dto.percentTariff !== undefined ? dto.percentTariff.toFixed(2) : device.percentTariff,
      latitude: dto.latitude !== undefined ? dto.latitude.toString() : device.latitude,
      longitude: dto.longitude !== undefined ? dto.longitude.toString() : device.longitude,
    });
    // Tariff edits only affect payments from here on; past rows keep the
    // commission they were charged.
    return this.devices.save(device);
  }

  async remove(id: string): Promise<void> {
    const device = await this.findById(id);
    await this.assignments.removeByDevice(device.id);
    await this.devices.softRemove(device);
  }

  /** Heartbeat / any inbound frame marks the terminal alive. */
  async markSeen(deviceId: string, seenAt = new Date()): Promise<void> {
    await this.devices.update({ id: deviceId }, { lastSeenAt: seenAt });
  }

  private async assertSiteBelongsToCompany(siteId: string, companyId: string): Promise<void> {
    const site = await this.sites.findById(siteId);
    if (site.companyId !== companyId) {
      throw new ConflictException('The object belongs to a different company');
    }
  }
}

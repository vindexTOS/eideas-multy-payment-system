import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginatedResult } from '../../shared/dto/paginated-result.dto';
import { PaginationQueryDto } from '../../shared/dto/pagination-query.dto';
import { UnregisteredDevice } from './entities/unregistered-device.entity';

/**
 * The pool of device ids heard on MQTT that nobody has registered yet.
 *
 * This is what makes onboarding self-service: plug the terminal in, it
 * starts talking, its id appears here, and the admin picks it from the
 * dropdown in the create-device form.
 */
@Injectable()
export class DeviceRegistryService {
  private readonly logger = new Logger(DeviceRegistryService.name);

  constructor(
    @InjectRepository(UnregisteredDevice)
    private readonly repo: Repository<UnregisteredDevice>,
  ) {}

  /**
   * Record that an unknown device id was heard. Done as a single upsert so
   * a burst of frames from the same box cannot race a read-modify-write.
   */
  async touch(input: {
    deviceUid: string;
    topic?: string | null;
    payload?: Record<string, unknown> | null;
    seenAt?: Date;
  }): Promise<void> {
    const seenAt = input.seenAt ?? new Date();
    try {
      await this.repo.query(
        `INSERT INTO unregistered_devices
           (device_uid, first_seen_at, last_seen_at, message_count, last_topic, last_payload)
         VALUES ($1, $2, $2, 1, $3, $4)
         ON CONFLICT (device_uid) DO UPDATE SET
           last_seen_at  = EXCLUDED.last_seen_at,
           last_topic    = EXCLUDED.last_topic,
           last_payload  = COALESCE(EXCLUDED.last_payload, unregistered_devices.last_payload),
           message_count = unregistered_devices.message_count + 1,
           updated_at    = now()`,
        [
          input.deviceUid,
          seenAt,
          input.topic ?? null,
          input.payload ? JSON.stringify(input.payload) : null,
        ],
      );
    } catch (error) {
      // Bookkeeping must never kill the message pipeline.
      this.logger.warn(
        `Could not record unregistered device ${input.deviceUid}: ${(error as Error).message}`,
      );
    }
  }

  async list(query: PaginationQueryDto): Promise<PaginatedResult<UnregisteredDevice>> {
    const qb = this.repo
      .createQueryBuilder('ud')
      .where('ud.ignored = false')
      .skip(query.skip)
      .take(query.limit)
      .orderBy('ud.lastSeenAt', query.sortOrder ?? 'DESC');

    if (query.search) {
      qb.andWhere('ud.deviceUid ILIKE :search', { search: `%${query.search}%` });
    }

    const [items, total] = await qb.getManyAndCount();
    return new PaginatedResult(items, total, query.page, query.limit);
  }

  /** Ids available for the create-device dropdown. */
  availableUids(limit = 200): Promise<UnregisteredDevice[]> {
    return this.repo.find({
      where: { ignored: false },
      order: { lastSeenAt: 'DESC' },
      take: limit,
    });
  }

  async setIgnored(id: string, ignored: boolean): Promise<UnregisteredDevice> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException(`Unregistered device ${id} not found`);
    row.ignored = ignored;
    return this.repo.save(row);
  }

  /** Called the moment a device is registered: it leaves the pool. */
  async claim(deviceUid: string): Promise<void> {
    await this.repo.delete({ deviceUid });
  }

  async remove(id: string): Promise<void> {
    const result = await this.repo.delete({ id });
    if (!result.affected) throw new NotFoundException(`Unregistered device ${id} not found`);
  }
}

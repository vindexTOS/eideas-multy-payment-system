import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginatedResult } from '../../shared/dto/paginated-result.dto';
import { PaginationQueryDto } from '../../shared/dto/pagination-query.dto';
import { DeviceMessage } from './entities/device-message.entity';
import { MqttInboundMessage } from './interfaces/mqtt-message.interface';

/** Append-only audit log of everything the broker delivered. */
@Injectable()
export class DeviceMessageService {
  private readonly logger = new Logger(DeviceMessageService.name);

  constructor(
    @InjectRepository(DeviceMessage)
    private readonly repo: Repository<DeviceMessage>,
  ) {}

  async log(
    message: MqttInboundMessage,
    outcome: { handledBy?: string | null; error?: string | null } = {},
  ): Promise<void> {
    try {
      await this.repo.save(
        this.repo.create({
          topic: message.topic.raw.slice(0, 320),
          deviceUid: message.topic.deviceUid || null,
          event: message.topic.event?.slice(0, 64) ?? null,
          payloadHex: message.frame.hex,
          decoded: this.describe(message),
          handledBy: outcome.handledBy ?? null,
          error: outcome.error ?? null,
          receivedAt: message.receivedAt,
        }),
      );
    } catch (error) {
      // Logging must never break the pipeline.
      this.logger.warn(`Could not persist device message: ${(error as Error).message}`);
    }
  }

  async list(
    query: PaginationQueryDto & { deviceUid?: string; event?: string },
  ): Promise<PaginatedResult<DeviceMessage>> {
    const qb = this.repo
      .createQueryBuilder('msg')
      .skip(query.skip)
      .take(query.limit)
      .orderBy('msg.receivedAt', query.sortOrder ?? 'DESC');

    if (query.deviceUid) qb.andWhere('msg.deviceUid = :deviceUid', { deviceUid: query.deviceUid });
    if (query.event) qb.andWhere('msg.event = :event', { event: query.event });
    if (query.search) {
      qb.andWhere('(msg.topic ILIKE :search OR msg.payloadHex ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    const [items, total] = await qb.getManyAndCount();
    return new PaginatedResult(items, total, query.page, query.limit);
  }

  private describe(message: MqttInboundMessage): Record<string, unknown> {
    const { frame } = message;
    return {
      framed: frame.framed,
      timestamp: frame.timestamp,
      command: frame.command,
      length: frame.length,
      json: frame.json,
      payloadUtf8: frame.payload.length <= 256 ? frame.payload.toString('utf8') : undefined,
    };
  }
}

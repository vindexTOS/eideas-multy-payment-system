import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginatedResult } from '../../shared/dto/paginated-result.dto';
import { PaginationQueryDto } from '../../shared/dto/pagination-query.dto';
import { DeviceMessage } from './entities/device-message.entity';
import { MqttInboundMessage, VidRecord } from './interfaces/mqtt-message.interface';
import {
  OPERATION_MODE_LABELS,
  OPERATION_RESULT_LABELS,
  OPERATION_VIDS,
  VID,
  hexVid,
} from './protocol/terminal-protocol';

/**
 * Postgres jsonb refuses "\u0000", and a binary payload decoded as utf8 is
 * full of NULs (an idle status is a single 0x00). Without this the row is
 * rejected and the frame silently missing from the log. The hex keeps the
 * real bytes.
 */
const withoutNul = (value: Record<string, unknown>): Record<string, unknown> =>
  JSON.parse(
    JSON.stringify(value, (_key, v: unknown) =>
      typeof v === 'string' ? v.replace(/\u0000/g, '') : v,
    ),
  ) as Record<string, unknown>;

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
          decoded: withoutNul(this.describe(message)),
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
      records: frame.records?.map((record) => this.describeRecord(record)),
      protocolError: frame.protocolError ?? undefined,
      payloadUtf8: frame.payload.length <= 256 ? frame.payload.toString('utf8') : undefined,
    };
  }

  /** `{ vid: '0x81', key: 'payment', value: 1, meaning: 'Success' }` - readable in the log. */
  private describeRecord(record: VidRecord): Record<string, unknown> {
    const { vid, value } = record;
    let meaning: string | undefined;
    if (value !== null) {
      if (OPERATION_VIDS.includes(vid)) meaning = OPERATION_RESULT_LABELS[value];
      else if (vid === VID.PAYMENT_STATUS)
        meaning = value === 0 ? 'Idle' : value === 1 ? 'Busy' : undefined;
      else if (vid === VID.OPERATION_MODE) meaning = OPERATION_MODE_LABELS[value];
    }
    return { vid: hexVid(vid), key: record.key, value, meaning, hex: record.hex };
  }
}

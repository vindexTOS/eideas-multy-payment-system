import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/base.entity';

/**
 * A device id we have heard on MQTT but which nobody has registered yet.
 * The device-create form picks its deviceUid from this pool.
 */
@Entity('unregistered_devices')
export class UnregisteredDevice extends BaseEntity {
  @ApiProperty()
  @Column({ name: 'device_uid', length: 128, unique: true })
  deviceUid: string;

  @ApiProperty()
  @Column({ name: 'first_seen_at', type: 'timestamptz' })
  firstSeenAt: Date;

  @ApiProperty()
  @Column({ name: 'last_seen_at', type: 'timestamptz' })
  lastSeenAt: Date;

  @ApiProperty({ default: 0 })
  @Column({ name: 'message_count', type: 'int', default: 0 })
  messageCount: number;

  @ApiPropertyOptional({ description: 'Last topic this id was heard on' })
  @Column({ name: 'last_topic', type: 'varchar', length: 320, nullable: true })
  lastTopic: string | null;

  /** Last decoded frame, so an admin can tell what the box is. */
  @ApiPropertyOptional()
  @Column({ name: 'last_payload', type: 'jsonb', nullable: true })
  lastPayload: Record<string, unknown> | null;

  /** Hidden from the pick list without losing the history. */
  @ApiProperty({ default: false })
  @Column({ default: false })
  ignored: boolean;
}

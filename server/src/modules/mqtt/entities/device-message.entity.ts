import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Append-only log of inbound MQTT frames. We do not have the device docs
 * yet, so keeping the raw bytes is how we decode them later; it is also the
 * audit trail when a company disputes an amount.
 */
@Entity('device_messages')
export class DeviceMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column({ length: 320 })
  @Index()
  topic: string;

  @ApiPropertyOptional()
  @Column({ name: 'device_uid', type: 'varchar', length: 128, nullable: true })
  @Index()
  deviceUid: string | null;

  @ApiPropertyOptional({ description: 'Event name the router resolved, if any' })
  @Column({ type: 'varchar', length: 64, nullable: true })
  event: string | null;

  /** Hex of the original buffer - lossless and greppable. */
  @ApiProperty()
  @Column({ name: 'payload_hex', type: 'text' })
  payloadHex: string;

  @ApiPropertyOptional({ description: 'Decoded frame when the codec understood it' })
  @Column({ type: 'jsonb', nullable: true })
  decoded: Record<string, unknown> | null;

  @ApiPropertyOptional()
  @Column({ name: 'handled_by', type: 'varchar', length: 64, nullable: true })
  handledBy: string | null;

  @ApiPropertyOptional()
  @Column({ type: 'text', nullable: true })
  error: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'received_at' })
  @Index()
  receivedAt: Date;
}

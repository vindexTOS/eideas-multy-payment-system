import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/base.entity';
import { PaymentSource } from '../../../shared/enums/payment-source.enum';
import { PaymentStatus } from '../../../shared/enums/payment-status.enum';
import { Company } from '../../companies/entities/company.entity';
import { Device } from '../../devices/entities/device.entity';

/**
 * One money-in event. This table is the only source of truth for earnings;
 * every chart is an aggregation over it.
 *
 * commission / netAmount are frozen at insert time using the device tariffs
 * as they were then - changing a tariff must never rewrite history.
 */
@Entity('payments')
@Index('idx_payment_company_paid_at', ['companyId', 'paidAt'])
@Index('idx_payment_device_paid_at', ['deviceId', 'paidAt'])
export class Payment extends BaseEntity {
  @ApiProperty({ example: '12.50' })
  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amount: string;

  /** Eideas service fee taken out of the amount. */
  @ApiProperty({ example: '0.63' })
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  commission: string;

  /** amount - commission: what the company earned. */
  @ApiProperty({ example: '11.87' })
  @Column({ name: 'net_amount', type: 'numeric', precision: 14, scale: 2, default: 0 })
  netAmount: string;

  @ApiProperty({ description: 'Which tariff rule produced the commission' })
  @Column({ name: 'applied_rule', length: 16, default: 'min_tariff' })
  appliedRule: string;

  @ApiProperty({ default: 'GEL' })
  @Column({ length: 3, default: 'GEL' })
  currency: string;

  @ApiProperty({ enum: PaymentSource })
  @Column({ type: 'enum', enum: PaymentSource, default: PaymentSource.TERMINAL })
  source: PaymentSource;

  @ApiProperty({ enum: PaymentStatus })
  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.SUCCESS })
  @Index()
  status: PaymentStatus;

  /**
   * Device-supplied transaction reference. Unique so a re-delivered MQTT
   * frame (qos 1 is at-least-once) cannot double-count money.
   */
  @ApiPropertyOptional()
  @Column({ name: 'external_ref', type: 'varchar', length: 160, nullable: true, unique: true })
  externalRef: string | null;

  /** When the money actually came in; drives every monthly bucket. */
  @ApiProperty()
  @Column({ name: 'paid_at', type: 'timestamptz' })
  @Index()
  paidAt: Date;

  /** Raw decoded frame, kept until the device protocol is documented. */
  @ApiPropertyOptional()
  @Column({ type: 'jsonb', nullable: true })
  raw: Record<string, unknown> | null;

  @ApiProperty()
  @Column({ name: 'device_id', type: 'uuid' })
  deviceId: string;

  @ManyToOne(() => Device, (device) => device.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'device_id' })
  device: Device;

  /** Denormalised from the device so company reports never need a join. */
  @ApiProperty()
  @Column({ name: 'company_id', type: 'uuid' })
  companyId: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @ApiPropertyOptional()
  @Column({ name: 'site_id', type: 'uuid', nullable: true })
  @Index()
  siteId: string | null;

  /** Set when the payment came from an app user balance (phase 2). */
  @ApiPropertyOptional()
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;
}

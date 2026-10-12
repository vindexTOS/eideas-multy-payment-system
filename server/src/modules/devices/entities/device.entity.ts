import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/base.entity';
import { DeviceStatus } from '../../../shared/enums/device-status.enum';
import { DeviceType } from '../../../shared/enums/device-type.enum';
import { Company } from '../../companies/entities/company.entity';
import { Payment } from '../../payments/entities/payment.entity';
import { Site } from '../../sites/entities/site.entity';

/** A payment terminal installed on a site. */
@Entity('devices')
export class Device extends BaseEntity {
  /**
   * Hardware id the device itself reports over MQTT (the value picked from
   * the unregistered-devices list). Immutable once registered.
   */
  @ApiProperty()
  @Column({ name: 'device_uid', length: 128, unique: true })
  deviceUid: string;

  @ApiProperty()
  @Column({ length: 160 })
  name: string;

  @ApiProperty({ enum: DeviceType, default: DeviceType.OTHER })
  @Column({ type: 'enum', enum: DeviceType, default: DeviceType.OTHER })
  type: DeviceType;

  /**
   * Free-text op mode, used while the device's type list is not final.
   * Shown instead of `type` when `type = other`.
   */
  @ApiPropertyOptional()
  @Column({ name: 'type_label', type: 'varchar', length: 120, nullable: true })
  typeLabel: string | null;

  /**
   * Minimum commission taken from each incoming payment. If the percentage
   * does not exceed this, this amount is taken instead.
   */
  @ApiProperty({ example: '0.50' })
  @Column({ name: 'min_tariff', type: 'numeric', precision: 14, scale: 2, default: 0 })
  minTariff: string;

  /** Commission percentage, e.g. `5.00` = 5%. */
  @ApiProperty({ example: '5.00' })
  @Column({ name: 'percent_tariff', type: 'numeric', precision: 6, scale: 2, default: 0 })
  percentTariff: string;

  /**
   * Terminal number. The device will probably report it; optional until the
   * spec lands, but never duplicated.
   */
  @ApiPropertyOptional()
  @Column({ type: 'varchar', length: 64, nullable: true, unique: true })
  number: string | null;

  /** Duplicates ARE allowed here (several terminals on one address). */
  @ApiPropertyOptional()
  @Column({ type: 'varchar', length: 320, nullable: true })
  address: string | null;

  @ApiPropertyOptional()
  @Column({ type: 'numeric', precision: 10, scale: 7, nullable: true })
  latitude: string | null;

  @ApiPropertyOptional()
  @Column({ type: 'numeric', precision: 10, scale: 7, nullable: true })
  longitude: string | null;

  @ApiPropertyOptional()
  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @ApiProperty({ enum: DeviceStatus, default: DeviceStatus.ACTIVE })
  @Column({ type: 'enum', enum: DeviceStatus, default: DeviceStatus.ACTIVE })
  status: DeviceStatus;

  /** Last heartbeat / any frame received. */
  @ApiPropertyOptional()
  @Column({ name: 'last_seen_at', type: 'timestamptz', nullable: true })
  lastSeenAt: Date | null;

  /** Whatever the firmware reports about itself; shape unknown for now. */
  @ApiPropertyOptional()
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @ApiProperty()
  @Column({ name: 'company_id', type: 'uuid' })
  @Index()
  companyId: string;

  @ManyToOne(() => Company, (company) => company.devices, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @ApiPropertyOptional()
  @Column({ name: 'site_id', type: 'uuid', nullable: true })
  @Index()
  siteId: string | null;

  @ManyToOne(() => Site, (site) => site.devices, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'site_id' })
  site: Site | null;

  @OneToMany(() => Payment, (payment) => payment.device)
  payments: Payment[];
}

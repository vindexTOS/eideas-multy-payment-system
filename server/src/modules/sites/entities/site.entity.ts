import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/base.entity';
import { Company } from '../../companies/entities/company.entity';
import { Device } from '../../devices/entities/device.entity';

/**
 * An "object" in the client's wording: a physical location (address)
 * registered to a company, holding one or more devices/terminals.
 */
@Entity('sites')
export class Site extends BaseEntity {
  @ApiProperty()
  @Column({ length: 160 })
  name: string;

  @ApiProperty()
  @Column({ length: 320 })
  address: string;

  @ApiPropertyOptional()
  @Column({ type: 'varchar', length: 120, nullable: true })
  city: string | null;

  /** Kept for the future map view; the address DB may fill these later. */
  @ApiPropertyOptional()
  @Column({ type: 'numeric', precision: 10, scale: 7, nullable: true })
  latitude: string | null;

  @ApiPropertyOptional()
  @Column({ type: 'numeric', precision: 10, scale: 7, nullable: true })
  longitude: string | null;

  @ApiPropertyOptional()
  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @ApiProperty({ default: true })
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @ApiProperty()
  @Column({ name: 'company_id', type: 'uuid' })
  @Index()
  companyId: string;

  @ManyToOne(() => Company, (company) => company.sites, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @OneToMany(() => Device, (device) => device.site)
  devices: Device[];
}

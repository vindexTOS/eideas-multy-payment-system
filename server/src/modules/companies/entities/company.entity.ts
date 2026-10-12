import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/base.entity';
import { Device } from '../../devices/entities/device.entity';
import { Site } from '../../sites/entities/site.entity';
import { User } from '../../users/entities/user.entity';

/** A client company whose terminals collect money through the platform. */
@Entity('companies')
export class Company extends BaseEntity {
  @ApiProperty()
  @Column({ length: 160 })
  @Index()
  name: string;

  /** Georgian company identification code. Must be unique. */
  @ApiProperty()
  @Column({ name: 'identification_code', length: 32, unique: true })
  identificationCode: string;

  @ApiProperty()
  @Column({ length: 160 })
  email: string;

  @ApiProperty()
  @Column({ length: 40 })
  phone: string;

  @ApiProperty()
  @Column({ name: 'legal_address', length: 320 })
  legalAddress: string;

  @ApiProperty()
  @Column({ name: 'bank_account', length: 64 })
  bankAccount: string;

  @ApiPropertyOptional()
  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @ApiProperty({ default: true })
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @OneToMany(() => Site, (site) => site.company)
  sites: Site[];

  @OneToMany(() => Device, (device) => device.company)
  devices: Device[];

  @OneToMany(() => User, (user) => user.company)
  users: User[];
}

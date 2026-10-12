import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/base.entity';
import { UserRole } from '../../../shared/enums/user-role.enum';
import { Company } from '../../companies/entities/company.entity';

@Entity('users')
export class User extends BaseEntity {
  @ApiProperty()
  @Column({ length: 160, unique: true })
  email: string;

  @Exclude()
  @Column({ name: 'password_hash', length: 200 })
  passwordHash: string;

  @ApiProperty()
  @Column({ name: 'full_name', length: 160 })
  fullName: string;

  @ApiPropertyOptional()
  @Column({ type: 'varchar', length: 40, nullable: true })
  phone: string | null;

  @ApiProperty({ enum: UserRole })
  @Column({ type: 'enum', enum: UserRole })
  @Index()
  role: UserRole;

  /**
   * NULL only for admins. Company owners and managers are always bound to
   * exactly one company.
   */
  @ApiPropertyOptional()
  @Column({ name: 'company_id', type: 'uuid', nullable: true })
  @Index()
  companyId: string | null;

  @ManyToOne(() => Company, (company) => company.users, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'company_id' })
  company: Company | null;

  @ApiProperty({ default: true })
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @ApiPropertyOptional()
  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;
}

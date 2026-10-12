import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/base.entity';

/**
 * Phase 2: an app user tops up a personal balance, then spends it on
 * devices. Scaffolded now so the payments pipeline already has the second
 * money path wired in.
 */
@Entity('wallets')
export class Wallet extends BaseEntity {
  @ApiProperty()
  @Column({ name: 'user_id', type: 'uuid', unique: true })
  @Index()
  userId: string;

  @ApiProperty({ example: '0.00' })
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  balance: string;

  @ApiProperty({ default: 'GEL' })
  @Column({ length: 3, default: 'GEL' })
  currency: string;
}

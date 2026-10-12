import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/base.entity';
import { Wallet } from './wallet.entity';

export enum WalletTransactionType {
  TOP_UP = 'top_up',
  /** Spent on a device - also creates a Payment on that device. */
  SPEND = 'spend',
  REFUND = 'refund',
  ADJUSTMENT = 'adjustment',
}

@Entity('wallet_transactions')
export class WalletTransaction extends BaseEntity {
  @ApiProperty({ enum: WalletTransactionType })
  @Column({ type: 'enum', enum: WalletTransactionType })
  type: WalletTransactionType;

  @ApiProperty({ example: '20.00' })
  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amount: string;

  @ApiProperty({ description: 'Balance after this transaction' })
  @Column({ name: 'balance_after', type: 'numeric', precision: 14, scale: 2 })
  balanceAfter: string;

  @ApiPropertyOptional()
  @Column({ name: 'device_id', type: 'uuid', nullable: true })
  deviceId: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'payment_id', type: 'uuid', nullable: true })
  paymentId: string | null;

  @ApiPropertyOptional()
  @Column({ type: 'varchar', length: 320, nullable: true })
  description: string | null;

  @ApiProperty()
  @Column({ name: 'wallet_id', type: 'uuid' })
  @Index()
  walletId: string;

  @ManyToOne(() => Wallet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'wallet_id' })
  wallet: Wallet;
}

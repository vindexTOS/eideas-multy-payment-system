import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsModule } from '../payments/payments.module';
import { Wallet } from './entities/wallet.entity';
import { WalletTransaction } from './entities/wallet-transaction.entity';
import { WalletService } from './wallet.service';

/**
 * Phase 2 scaffolding. No controller yet on purpose - the mobile app does
 * not exist, and an unused public endpoint for moving money is a liability.
 * The service is ready for when it does.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Wallet, WalletTransaction]), PaymentsModule],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}

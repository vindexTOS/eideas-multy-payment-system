import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PaymentSource } from '../../shared/enums/payment-source.enum';
import { round2, toAmount, toNumericString } from '../../shared/utils/money.util';
import { PaymentsService } from '../payments/payments.service';
import { Wallet } from './entities/wallet.entity';
import { WalletTransaction, WalletTransactionType } from './entities/wallet-transaction.entity';

/**
 * The second money path, scaffolded for the mobile app (phase 2):
 *
 *   top up personal balance -> spend at a device -> the spend becomes a
 *   Payment on that device, so it lands in the same earnings numbers as a
 *   card tap at the terminal.
 *
 * Balance moves run inside a transaction with a row lock: two concurrent
 * spends must never both pass the "enough balance?" check.
 */
@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    @InjectRepository(Wallet)
    private readonly wallets: Repository<Wallet>,
    @InjectRepository(WalletTransaction)
    private readonly transactions: Repository<WalletTransaction>,
    private readonly payments: PaymentsService,
    private readonly dataSource: DataSource,
  ) {}

  async getOrCreate(userId: string): Promise<Wallet> {
    const existing = await this.wallets.findOne({ where: { userId } });
    if (existing) return existing;
    return this.wallets.save(this.wallets.create({ userId, balance: '0.00' }));
  }

  async topUp(userId: string, amount: number, description?: string): Promise<WalletTransaction> {
    if (amount <= 0) throw new BadRequestException('Top-up amount must be positive');
    return this.move(userId, WalletTransactionType.TOP_UP, amount, { description });
  }

  /**
   * Spend from the balance on a device. The Payment is created first: if the
   * ledger write fails afterwards we would rather owe the user a cent than
   * hand a company money that was never deducted.
   */
  async spendOnDevice(
    userId: string,
    deviceId: string,
    amount: number,
    externalRef?: string,
  ): Promise<WalletTransaction> {
    if (amount <= 0) throw new BadRequestException('Spend amount must be positive');

    const tx = await this.move(userId, WalletTransactionType.SPEND, -amount, {
      deviceId,
      description: 'Spent from app balance',
    });

    const payment = await this.payments.record({
      deviceId,
      amount,
      source: PaymentSource.APP_BALANCE,
      userId,
      externalRef: externalRef ?? `wallet:${tx.id}`,
      raw: { walletTransactionId: tx.id },
    });

    tx.paymentId = payment.id;
    return this.transactions.save(tx);
  }

  listTransactions(userId: string, limit = 50): Promise<WalletTransaction[]> {
    return this.transactions
      .createQueryBuilder('tx')
      .innerJoin(Wallet, 'wallet', 'wallet.id = tx.wallet_id')
      .where('wallet.user_id = :userId', { userId })
      .orderBy('tx.createdAt', 'DESC')
      .take(limit)
      .getMany();
  }

  private async move(
    userId: string,
    type: WalletTransactionType,
    delta: number,
    extra: { deviceId?: string; description?: string } = {},
  ): Promise<WalletTransaction> {
    await this.getOrCreate(userId);

    return this.dataSource.transaction(async (manager) => {
      const wallet = await manager
        .createQueryBuilder(Wallet, 'wallet')
        .setLock('pessimistic_write')
        .where('wallet.user_id = :userId', { userId })
        .getOne();
      if (!wallet) throw new BadRequestException('Wallet not found');

      const next = round2(toAmount(wallet.balance) + delta);
      if (next < 0) throw new BadRequestException('Insufficient balance');

      wallet.balance = toNumericString(next);
      await manager.save(wallet);

      return manager.save(
        manager.create(WalletTransaction, {
          walletId: wallet.id,
          type,
          amount: toNumericString(Math.abs(delta)),
          balanceAfter: wallet.balance,
          deviceId: extra.deviceId ?? null,
          description: extra.description ?? null,
        }),
      );
    });
  }
}

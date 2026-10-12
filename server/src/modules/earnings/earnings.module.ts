import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from '../payments/entities/payment.entity';
import { AccessModule } from '../access/access.module';
import { EarningsController } from './earnings.controller';
import { EarningsScopeService } from './earnings-scope.service';
import { EarningsService } from './earnings.service';

/**
 * Reporting side of the money model. Owns no writes - only aggregations -
 * which is what lets every other module import it without a cycle.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Payment]), AccessModule],
  controllers: [EarningsController],
  providers: [EarningsService, EarningsScopeService],
  exports: [EarningsService, EarningsScopeService],
})
export class EarningsModule {}

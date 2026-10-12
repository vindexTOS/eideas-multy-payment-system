import { Injectable } from '@nestjs/common';
import { round2, toAmount } from '../utils/money.util';

export interface CommissionInput {
  /** Gross amount that came in from the terminal. */
  amount: string | number;
  /** `Device.minTariff` - the floor we always take. */
  minTariff: string | number;
  /** `Device.percentTariff` - e.g. 5 means 5%. */
  percentTariff: string | number;
}

export interface CommissionResult {
  amount: number;
  /** Eideas (service) commission. */
  commission: number;
  /** What the company keeps: amount - commission. */
  netAmount: number;
  /** Which rule won, handy for audits and for the device detail screen. */
  appliedRule: 'min_tariff' | 'percent';
}

/**
 * THE commission rule, in exactly one place.
 *
 * Per the spec: take the percentage of the incoming amount; if that is not
 * greater than the device's minimum tariff, take the minimum tariff instead.
 * i.e. commission = max(minTariff, amount * percent / 100).
 *
 * Applied per payment (a terminal transaction), not per month - the minimum
 * is a floor on each transaction. If the client later means "monthly floor",
 * this is the only file that changes.
 */
@Injectable()
export class CommissionService {
  calculate(input: CommissionInput): CommissionResult {
    const amount = round2(Math.max(0, toAmount(input.amount)));
    const minTariff = Math.max(0, toAmount(input.minTariff));
    const percentTariff = Math.max(0, toAmount(input.percentTariff));

    const percentPart = round2((amount * percentTariff) / 100);
    const usePercent = percentPart > minTariff;
    // Never take more than what actually came in.
    const commission = round2(Math.min(amount, usePercent ? percentPart : minTariff));

    return {
      amount,
      commission,
      netAmount: round2(amount - commission),
      appliedRule: usePercent ? 'percent' : 'min_tariff',
    };
  }
}

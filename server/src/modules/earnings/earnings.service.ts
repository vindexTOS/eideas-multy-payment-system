import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentStatus } from '../../shared/enums/payment-status.enum';
import { round2, toAmount } from '../../shared/utils/money.util';
import { MonthRange, buildMonthRange, toMonthKey } from '../../shared/utils/month-range.util';
import { Payment } from '../payments/entities/payment.entity';
import { EarningsMonthDto, EarningsSeriesDto, EarningsTotalsDto } from './dto/earnings-series.dto';

export interface EarningsScope {
  companyId?: string | null;
  siteId?: string | null;
  deviceId?: string | null;
  /** Restrict to a device whitelist (manager role). */
  deviceIds?: string[] | null;
}

interface RawMonthRow {
  month: string;
  total: string;
  commission: string;
  count: string;
}

interface RawGroupRow {
  key: string;
  total: string;
  commission: string;
  count: string;
}

/**
 * Read-only aggregation over `payments`. Deliberately dependency-free (it
 * only owns the Payment repository) so every other module can import it
 * without creating a cycle.
 *
 * A month runs from the 1st 00:00:00.000 UTC to the last day 23:59:59.999
 * UTC, inclusive - see buildMonthRange.
 */
@Injectable()
export class EarningsService {
  constructor(
    @InjectRepository(Payment)
    private readonly payments: Repository<Payment>,
  ) {}

  /**
   * Monthly series for the three charts:
   *  - total      = everything that came in
   *  - commission = the Eideas service fee
   *  - net        = total - commission (the company own earnings)
   */
  async monthlySeries(
    scope: EarningsScope,
    range: { from?: string; to?: string; months?: number },
  ): Promise<EarningsSeriesDto> {
    const window = buildMonthRange(range);
    const rows = await this.rawMonthlyRows(scope, window);

    const byMonth = new Map<string, RawMonthRow>();
    for (const row of rows) {
      byMonth.set(toMonthKey(new Date(row.month)), row);
    }

    const months: EarningsMonthDto[] = window.months.map(({ month }) => {
      const row = byMonth.get(month);
      const total = round2(toAmount(row?.total));
      const commission = round2(toAmount(row?.commission));
      return {
        month,
        total,
        commission,
        net: round2(total - commission),
        count: row ? Number.parseInt(row.count, 10) : 0,
      };
    });

    const totals = months.reduce<EarningsTotalsDto>(
      (acc, m) => ({
        total: round2(acc.total + m.total),
        commission: round2(acc.commission + m.commission),
        net: round2(acc.net + m.net),
        count: acc.count + m.count,
      }),
      { total: 0, commission: 0, net: 0, count: 0 },
    );

    return {
      months,
      totals,
      from: window.months[0]?.month ?? '',
      to: window.months[window.months.length - 1]?.month ?? '',
      currency: 'GEL',
    };
  }

  /** Window totals without the per-month breakdown. */
  async totals(
    scope: EarningsScope,
    range: { from?: string; to?: string; months?: number } = { months: 1 },
  ): Promise<EarningsTotalsDto> {
    const window = buildMonthRange(range);
    const row = await this.baseQuery(scope, window)
      .select('COALESCE(SUM(payment.amount), 0)', 'total')
      .addSelect('COALESCE(SUM(payment.commission), 0)', 'commission')
      .addSelect('COUNT(payment.id)', 'count')
      .getRawOne<{ total: string; commission: string; count: string }>();

    const total = round2(toAmount(row?.total));
    const commission = round2(toAmount(row?.commission));
    return {
      total,
      commission,
      net: round2(total - commission),
      count: Number.parseInt(row?.count ?? '0', 10),
    };
  }

  /**
   * Totals per company for a month window - one query for the whole admin
   * landing page instead of N queries.
   */
  totalsByCompany(
    companyIds: string[],
    range?: { from?: string; to?: string; months?: number },
  ): Promise<Map<string, EarningsTotalsDto>> {
    return this.totalsGroupedBy('company_id', companyIds, range);
  }

  totalsByDevice(
    deviceIds: string[],
    range?: { from?: string; to?: string; months?: number },
  ): Promise<Map<string, EarningsTotalsDto>> {
    return this.totalsGroupedBy('device_id', deviceIds, range);
  }

  totalsBySite(
    siteIds: string[],
    range?: { from?: string; to?: string; months?: number },
  ): Promise<Map<string, EarningsTotalsDto>> {
    return this.totalsGroupedBy('site_id', siteIds, range);
  }

  private async totalsGroupedBy(
    column: 'company_id' | 'device_id' | 'site_id',
    ids: string[],
    range: { from?: string; to?: string; months?: number } = { months: 1 },
  ): Promise<Map<string, EarningsTotalsDto>> {
    const result = new Map<string, EarningsTotalsDto>();
    for (const id of ids) {
      result.set(id, { total: 0, commission: 0, net: 0, count: 0 });
    }
    if (!ids.length) return result;

    const window = buildMonthRange(range);
    const rows = await this.payments
      .createQueryBuilder('payment')
      .select(`payment.${column}`, 'key')
      .addSelect('COALESCE(SUM(payment.amount), 0)', 'total')
      .addSelect('COALESCE(SUM(payment.commission), 0)', 'commission')
      .addSelect('COUNT(payment.id)', 'count')
      .where('payment.status = :status', { status: PaymentStatus.SUCCESS })
      .andWhere('payment.deleted_at IS NULL')
      .andWhere(`payment.${column} IN (:...ids)`, { ids })
      .andWhere('payment.paid_at BETWEEN :start AND :end', {
        start: window.start,
        end: window.end,
      })
      .groupBy(`payment.${column}`)
      .getRawMany<RawGroupRow>();

    for (const row of rows) {
      const total = round2(toAmount(row.total));
      const commission = round2(toAmount(row.commission));
      result.set(row.key, {
        total,
        commission,
        net: round2(total - commission),
        count: Number.parseInt(row.count, 10),
      });
    }
    return result;
  }

  private rawMonthlyRows(scope: EarningsScope, window: MonthRange): Promise<RawMonthRow[]> {
    return this.baseQuery(scope, window)
      .select("date_trunc('month', payment.paid_at AT TIME ZONE 'UTC')", 'month')
      .addSelect('COALESCE(SUM(payment.amount), 0)', 'total')
      .addSelect('COALESCE(SUM(payment.commission), 0)', 'commission')
      .addSelect('COUNT(payment.id)', 'count')
      .groupBy('month')
      .orderBy('month', 'ASC')
      .getRawMany<RawMonthRow>();
  }

  private baseQuery(scope: EarningsScope, window: MonthRange) {
    const qb = this.payments
      .createQueryBuilder('payment')
      .where('payment.status = :status', { status: PaymentStatus.SUCCESS })
      .andWhere('payment.deleted_at IS NULL')
      .andWhere('payment.paid_at BETWEEN :start AND :end', {
        start: window.start,
        end: window.end,
      });

    if (scope.companyId) {
      qb.andWhere('payment.company_id = :companyId', { companyId: scope.companyId });
    }
    if (scope.siteId) qb.andWhere('payment.site_id = :siteId', { siteId: scope.siteId });
    if (scope.deviceId) qb.andWhere('payment.device_id = :deviceId', { deviceId: scope.deviceId });
    if (scope.deviceIds) {
      // An empty whitelist must return nothing, not everything.
      if (!scope.deviceIds.length) qb.andWhere('1 = 0');
      else
        qb.andWhere('payment.device_id IN (:...scopedDeviceIds)', {
          scopedDeviceIds: scope.deviceIds,
        });
    }
    return qb;
  }
}

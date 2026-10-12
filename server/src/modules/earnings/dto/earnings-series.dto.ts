import { ApiProperty } from '@nestjs/swagger';

export class EarningsMonthDto {
  @ApiProperty({ example: '2026-03' }) month: string;
  @ApiProperty({ description: 'Gross money that came in' }) total: number;
  @ApiProperty({ description: 'Eideas service commission' }) commission: number;
  @ApiProperty({ description: 'total - commission: what the company earned' }) net: number;
  @ApiProperty({ description: 'Number of payments' }) count: number;
}

export class EarningsTotalsDto {
  @ApiProperty() total: number;
  @ApiProperty() commission: number;
  @ApiProperty() net: number;
  @ApiProperty() count: number;
}

/**
 * Exactly what the three column charts need: one gap-free month list plus
 * the window totals.
 */
export class EarningsSeriesDto {
  @ApiProperty({ type: [EarningsMonthDto] }) months: EarningsMonthDto[];
  @ApiProperty({ type: EarningsTotalsDto }) totals: EarningsTotalsDto;
  @ApiProperty({ example: '2026-01' }) from: string;
  @ApiProperty({ example: '2026-12' }) to: string;
  @ApiProperty({ default: 'GEL' }) currency: string;
}

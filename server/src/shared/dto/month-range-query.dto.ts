import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Earnings are always reported per calendar month (1st 00:00 .. last day
 * 23:59:59.999 inclusive), so charts ask for a window of months.
 */
export class MonthRangeQueryDto {
  @ApiPropertyOptional({ description: 'Inclusive first month, e.g. 2026-01', example: '2026-01' })
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({ description: 'Inclusive last month, e.g. 2026-12', example: '2026-12' })
  @IsOptional()
  to?: string;

  @ApiPropertyOptional({
    description: 'Shortcut: last N months ending with the current one (ignored when from/to set)',
    default: 12,
  })
  @IsOptional()
  @Transform(({ value }) => Number.parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(60)
  months = 12;
}

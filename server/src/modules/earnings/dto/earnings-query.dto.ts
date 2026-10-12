import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { MonthRangeQueryDto } from '../../../shared/dto/month-range-query.dto';

export class EarningsQueryDto extends MonthRangeQueryDto {
  @ApiPropertyOptional({ description: 'Admin only - scope to one company' })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional({ description: 'Scope to one object/site' })
  @IsOptional()
  @IsUUID()
  siteId?: string;

  @ApiPropertyOptional({ description: 'Scope to one device/terminal' })
  @IsOptional()
  @IsUUID()
  deviceId?: string;
}

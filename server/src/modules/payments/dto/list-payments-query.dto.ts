import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../shared/dto/pagination-query.dto';
import { PaymentSource } from '../../../shared/enums/payment-source.enum';
import { PaymentStatus } from '../../../shared/enums/payment-status.enum';

export class ListPaymentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Admin only - filter by company' })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  siteId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  deviceId?: string;

  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @ApiPropertyOptional({ enum: PaymentSource })
  @IsOptional()
  @IsEnum(PaymentSource)
  source?: PaymentSource;

  @ApiPropertyOptional({ description: 'Inclusive ISO date-time lower bound' })
  @IsOptional()
  @IsDateString()
  paidFrom?: string;

  @ApiPropertyOptional({ description: 'Inclusive ISO date-time upper bound' })
  @IsOptional()
  @IsDateString()
  paidTo?: string;
}

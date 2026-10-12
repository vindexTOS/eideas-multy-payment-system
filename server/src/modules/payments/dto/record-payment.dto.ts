import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { PaymentSource } from '../../../shared/enums/payment-source.enum';

/**
 * Admin/manual payment entry. The MQTT pipeline does NOT go through this DTO
 * - it calls `PaymentsService.record()` directly with the decoded frame.
 */
export class RecordPaymentDto {
  @ApiProperty({ description: 'Target terminal' })
  @IsUUID()
  deviceId: string;

  @ApiProperty({ example: 12.5, description: 'Gross amount that came in' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({ description: 'Defaults to now' })
  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @ApiPropertyOptional({
    enum: PaymentSource,
    default: PaymentSource.MANUAL,
    description: 'How the money arrived',
  })
  @IsOptional()
  @IsEnum(PaymentSource)
  source?: PaymentSource;

  @ApiPropertyOptional({ description: 'Idempotency key - a repeat is ignored, not double-counted' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  externalRef?: string;

  @ApiPropertyOptional({ description: 'App user this payment belongs to (phase 2)' })
  @IsOptional()
  @IsUUID()
  userId?: string;
}

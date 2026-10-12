import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../shared/dto/pagination-query.dto';

/**
 * Lets us exercise the whole pipeline - decode, registry, handler, payment,
 * earnings - with no device and no broker. This is how the platform got
 * built before the device documentation existed.
 */
export class SimulateMessageDto {
  @ApiProperty({ example: 'TERM-0001', description: 'Device uid to impersonate' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  deviceUid: string;

  @ApiPropertyOptional({ example: 'payment', default: 'payment' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  event?: string;

  @ApiPropertyOptional({
    description: 'JSON payload, e.g. { "amount": 12.5, "ref": "A-1001" }',
    example: { amount: 12.5, ref: 'A-1001' },
  })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Hex payload, used instead of `payload` for binary frames' })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  payloadHex?: string;
}

export class PublishCommandDto {
  @ApiProperty({ example: 'TERM-0001' })
  @IsString()
  @IsNotEmpty()
  deviceUid: string;

  @ApiProperty({ example: 1, description: 'Command/opcode byte' })
  command: number;

  @ApiPropertyOptional({
    description: 'Typed payload fields, encoded in order',
    example: [{ type: 'number16', value: 500 }],
  })
  @IsOptional()
  fields?: Array<{ type: string; value: string | number }>;
}

export class ListMessagesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceUid?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  event?: string;
}

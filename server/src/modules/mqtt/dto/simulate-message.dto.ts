import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../shared/dto/pagination-query.dto';

export class SimulateRecordDto {
  @ApiProperty({ example: 0x81, description: 'VID, e.g. 128 (0x80) or 129 (0x81)' })
  @IsInt()
  @Min(0)
  @Max(255)
  vid: number;

  @ApiPropertyOptional({ example: 1, description: 'Omit for a zero-length record' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(0xffff)
  value?: number;
}

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

  @ApiPropertyOptional({
    type: [SimulateRecordDto],
    description:
      'Terminal-protocol records, encoded into a real frame (takes precedence over payloadHex/payload)',
    example: [
      { vid: 0x80, value: 500 },
      { vid: 0x81, value: 1 },
    ],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SimulateRecordDto)
  records?: SimulateRecordDto[];
}

export class PublishCommandDto {
  @ApiProperty({ example: 'TERM-0001' })
  @IsString()
  @IsNotEmpty()
  deviceUid: string;

  @ApiProperty({ example: 1, description: 'Command/opcode byte' })
  @IsInt()
  @Min(0)
  @Max(255)
  command: number;

  @ApiPropertyOptional({
    description: 'Typed payload fields, encoded in order',
    example: [{ type: 'number16', value: 500 }],
  })
  @IsOptional()
  @IsArray()
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

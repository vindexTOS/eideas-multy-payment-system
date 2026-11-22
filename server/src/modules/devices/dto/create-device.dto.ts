import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { DeviceStatus } from '../../../shared/enums/device-status.enum';
import { DeviceType } from '../../../shared/enums/device-type.enum';
import { blankToNull } from '../../../shared/utils/blank-to-null.util';

export class CreateDeviceDto {
  @ApiProperty({
    description: 'Hardware id, picked from the unregistered-devices list',
    example: 'TERM-0001',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  deviceUid: string;

  @ApiProperty({ example: 'Car wash bay 1' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name: string;

  @ApiPropertyOptional({ enum: DeviceType, default: DeviceType.OTHER })
  @IsOptional()
  @IsEnum(DeviceType)
  type?: DeviceType;

  @ApiPropertyOptional({
    description: 'Free-text op mode, used while the device type list is not final',
  })
  @IsOptional()
  @Transform(blankToNull)
  @IsString()
  @MaxLength(120)
  typeLabel?: string | null;

  @ApiProperty({ description: 'Required for admins; forced to own company otherwise' })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional({ description: 'Object/site this terminal is installed on' })
  @IsOptional()
  @IsUUID()
  siteId?: string;

  @ApiProperty({
    description: 'Minimum commission taken from each payment',
    example: 0.5,
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minTariff: number;

  @ApiProperty({ description: 'Commission percentage, e.g. 5 = 5%', example: 5 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  percentTariff: number;

  @ApiPropertyOptional({
    description: 'Terminal number, optional but never duplicated. Blank = no number.',
  })
  @IsOptional()
  // An emptied field must mean "no number" (NULL), never "": the column is
  // unique, so a second blank "" would be refused as a duplicate.
  @Transform(blankToNull)
  @IsString()
  @MaxLength(64)
  number?: string | null;

  @ApiPropertyOptional({ description: 'Duplicates are allowed here' })
  @IsOptional()
  @Transform(blankToNull)
  @IsString()
  @MaxLength(320)
  address?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(blankToNull)
  @IsString()
  @MaxLength(2000)
  comment?: string | null;

  @ApiPropertyOptional({ enum: DeviceStatus, default: DeviceStatus.ACTIVE })
  @IsOptional()
  @IsEnum(DeviceStatus)
  status?: DeviceStatus;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { blankToNull } from '../../../shared/utils/blank-to-null.util';

export class CreateSiteDto {
  @ApiProperty({ example: 'Saburtalo car wash' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name: string;

  @ApiProperty({ example: 'Tbilisi, Kavtaradze st. 23' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(320)
  address: string;

  @ApiPropertyOptional({ example: 'Tbilisi' })
  @IsOptional()
  @Transform(blankToNull)
  @IsString()
  @MaxLength(120)
  city?: string | null;

  @ApiPropertyOptional({ description: 'For the future map view' })
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

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ description: 'Required for admins; forced to own company otherwise' })
  @IsOptional()
  @IsUUID()
  companyId?: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export class CreateCompanyDto {
  @ApiProperty({ example: 'Clean Car LLC' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name: string;

  @ApiProperty({ example: '405123456', description: 'Identification code, unique' })
  @IsString()
  @Length(5, 32)
  identificationCode: string;

  @ApiProperty({ example: 'office@cleancar.ge' })
  @IsEmail()
  @MaxLength(160)
  email: string;

  @ApiProperty({ example: '+995555123456' })
  @IsString()
  @Length(5, 40)
  phone: string;

  @ApiProperty({ example: 'Tbilisi, Chavchavadze ave. 1' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(320)
  legalAddress: string;

  @ApiProperty({ example: 'GE29TB0000000123456789' })
  @IsString()
  @Length(5, 64)
  bankAccount: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

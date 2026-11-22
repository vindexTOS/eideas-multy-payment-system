import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';
import { CreateCompanyDto } from './create-company.dto';

export class UpdateCompanyDto extends PartialType(
  OmitType(CreateCompanyDto, ['password'] as const),
) {
  @ApiPropertyOptional({
    description:
      'Set to reset the company login password. A company without a login gets one created.',
  })
  @IsOptional()
  @IsString()
  @Length(8, 72)
  password?: string;
}

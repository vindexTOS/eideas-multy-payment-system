import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

/** The role and company of an existing account are fixed - create a new one. */
export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password', 'role', 'companyId'] as const),
) {
  @ApiPropertyOptional({ description: 'Set to reset the password' })
  @IsOptional()
  @IsString()
  @Length(8, 72)
  password?: string;
}

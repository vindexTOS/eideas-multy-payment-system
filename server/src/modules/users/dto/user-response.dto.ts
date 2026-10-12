import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../../shared/enums/user-role.enum';

export class UserResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty() fullName: string;
  @ApiPropertyOptional() phone: string | null;
  @ApiProperty({ enum: UserRole }) role: UserRole;
  @ApiPropertyOptional() companyId: string | null;
  @ApiPropertyOptional() companyName?: string | null;
  @ApiProperty() isActive: boolean;
  @ApiPropertyOptional() lastLoginAt: Date | null;
  @ApiProperty({ type: [String], description: 'Manager role: assigned device ids' })
  deviceIds: string[];
  @ApiProperty() createdAt: Date;
}

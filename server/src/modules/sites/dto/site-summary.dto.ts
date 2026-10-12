import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SiteSummaryDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() address: string;
  @ApiPropertyOptional() city: string | null;
  @ApiProperty() companyId: string;
  @ApiPropertyOptional() companyName?: string;
  @ApiProperty() isActive: boolean;
  @ApiProperty() deviceCount: number;
  @ApiProperty({ description: 'Gross income, current calendar month' })
  monthEarnings: number;
  @ApiProperty() monthCommission: number;
  @ApiProperty() createdAt: Date;
}

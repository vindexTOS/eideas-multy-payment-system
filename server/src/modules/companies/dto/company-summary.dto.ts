import { ApiProperty } from '@nestjs/swagger';

/** Row shape of the admin landing page: every company with its counters. */
export class CompanySummaryDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() identificationCode: string;
  @ApiProperty() email: string;
  @ApiProperty() phone: string;
  @ApiProperty() legalAddress: string;
  @ApiProperty() bankAccount: string;
  @ApiProperty() isActive: boolean;
  @ApiProperty() siteCount: number;
  @ApiProperty() deviceCount: number;
  @ApiProperty({ description: 'Gross income, current calendar month' })
  monthEarnings: number;
  @ApiProperty({ description: 'Eideas commission, current calendar month' })
  monthCommission: number;
  @ApiProperty() createdAt: Date;
}

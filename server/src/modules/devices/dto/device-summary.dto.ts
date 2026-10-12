import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DeviceStatus } from '../../../shared/enums/device-status.enum';
import { DeviceType } from '../../../shared/enums/device-type.enum';

export class DeviceSummaryDto {
  @ApiProperty() id: string;
  @ApiProperty() deviceUid: string;
  @ApiProperty() name: string;
  @ApiProperty({ enum: DeviceType }) type: DeviceType;
  @ApiPropertyOptional() typeLabel: string | null;
  @ApiProperty({ enum: DeviceStatus }) status: DeviceStatus;
  @ApiPropertyOptional() number: string | null;
  @ApiPropertyOptional() address: string | null;
  @ApiProperty() minTariff: number;
  @ApiProperty() percentTariff: number;
  @ApiProperty() companyId: string;
  @ApiPropertyOptional() companyName?: string;
  @ApiPropertyOptional() siteId: string | null;
  @ApiPropertyOptional() siteName?: string | null;
  @ApiPropertyOptional() lastSeenAt: Date | null;
  @ApiProperty({ description: 'Gross income, current calendar month' })
  monthEarnings: number;
  @ApiProperty() monthCommission: number;
  @ApiProperty() monthNet: number;
  @ApiProperty() createdAt: Date;
}

import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateDeviceDto } from './create-device.dto';

/**
 * `deviceUid` and `companyId` are immutable: the uid identifies the physical
 * box, and moving a device between companies would corrupt earnings history.
 * Delete and re-register instead.
 */
export class UpdateDeviceDto extends PartialType(
  OmitType(CreateDeviceDto, ['deviceUid', 'companyId'] as const),
) {}

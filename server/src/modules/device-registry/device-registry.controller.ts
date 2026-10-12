import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../../shared/decorators/api-auth.decorator';
import { PaginatedResult } from '../../shared/dto/paginated-result.dto';
import { PaginationQueryDto } from '../../shared/dto/pagination-query.dto';
import { UserRole } from '../../shared/enums/user-role.enum';
import { DeviceRegistryService } from './device-registry.service';
import { UnregisteredDevice } from './entities/unregistered-device.entity';

@ApiTags('unregistered-devices')
@Controller('unregistered-devices')
export class DeviceRegistryController {
  constructor(private readonly registry: DeviceRegistryService) {}

  @Get()
  @Auth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Device ids seen on MQTT but not registered yet' })
  list(@Query() query: PaginationQueryDto): Promise<PaginatedResult<UnregisteredDevice>> {
    return this.registry.list(query);
  }

  @Get('options')
  @Auth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Dropdown options for the create-device form' })
  options(): Promise<UnregisteredDevice[]> {
    return this.registry.availableUids();
  }

  @Patch(':id/ignore')
  @Auth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Hide an id from the pick list without losing its history' })
  ignore(@Param('id', ParseUUIDPipe) id: string): Promise<UnregisteredDevice> {
    return this.registry.setIgnored(id, true);
  }

  @Patch(':id/restore')
  @Auth(UserRole.ADMIN)
  restore(@Param('id', ParseUUIDPipe) id: string): Promise<UnregisteredDevice> {
    return this.registry.setIgnored(id, false);
  }

  @Delete(':id')
  @Auth(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.registry.remove(id);
  }
}

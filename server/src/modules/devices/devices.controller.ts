import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../../shared/decorators/api-auth.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { PaginatedResult } from '../../shared/dto/paginated-result.dto';
import { ALL_ROLES, UserRole } from '../../shared/enums/user-role.enum';
import { AuthenticatedUser } from '../../shared/interfaces/authenticated-user.interface';
import { EarningsSeriesDto } from '../earnings/dto/earnings-series.dto';
import { EarningsQueryDto } from '../earnings/dto/earnings-query.dto';
import { EarningsScopeService } from '../earnings/earnings-scope.service';
import { EarningsService } from '../earnings/earnings.service';
import { DevicesService } from './devices.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { DeviceSummaryDto } from './dto/device-summary.dto';
import { ListDevicesQueryDto } from './dto/list-devices-query.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { Device } from './entities/device.entity';

@ApiTags('devices')
@Controller('devices')
export class DevicesController {
  constructor(
    private readonly devices: DevicesService,
    private readonly earnings: EarningsService,
    private readonly earningsScope: EarningsScopeService,
  ) {}

  @Get()
  @Auth(...ALL_ROLES)
  @ApiOperation({ summary: 'List terminals visible to the caller' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListDevicesQueryDto,
  ): Promise<PaginatedResult<DeviceSummaryDto>> {
    return this.devices.list(user, query);
  }

  @Get(':id')
  @Auth(...ALL_ROLES)
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Device> {
    return this.devices.findOneScoped(user, id);
  }

  @Get(':id/earnings')
  @Auth(...ALL_ROLES)
  @ApiOperation({
    summary: 'Monthly earnings columns for this terminal',
    description: 'Same three series as the company page, for one device.',
  })
  async earningsSeries(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: EarningsQueryDto,
  ): Promise<EarningsSeriesDto> {
    // Access check first: a 404 must not be distinguishable from empty data.
    await this.devices.findOneScoped(user, id);
    const scope = await this.earningsScope.resolve(user, { deviceId: id });
    return this.earnings.monthlySeries(scope, query);
  }

  @Post()
  @Auth(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Register a terminal',
    description: 'deviceUid comes from the unregistered-devices pool and leaves it on success.',
  })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDeviceDto): Promise<Device> {
    return this.devices.create(user, dto);
  }

  @Patch(':id')
  @Auth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Edit a terminal (tariff changes apply to future payments only)' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDeviceDto,
  ): Promise<Device> {
    return this.devices.update(user, id, dto);
  }

  @Delete(':id')
  @Auth(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.devices.remove(id);
  }
}

import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { DeviceView, FrameEntry } from './device.types';
import {
  CompleteDto,
  CreateDeviceDto,
  SendOperationDto,
  SendPaymentDto,
  SendRawDto,
  SendStatusDto,
  UpdateDeviceDto,
} from './devices.dto';
import { DevicesService } from './devices.service';

/** Every route here is behind the super-admin guard (see AuthGuard). */
@Controller('devices')
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Get()
  list(): DeviceView[] {
    return this.devices.list();
  }

  @Post()
  create(@Body() dto: CreateDeviceDto): DeviceView {
    return this.devices.create(dto);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): DeviceView {
    return this.devices.get(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDeviceDto): DeviceView {
    return this.devices.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.devices.remove(id);
  }

  @Post(':id/connect')
  @HttpCode(HttpStatus.OK)
  connect(@Param('id', ParseUUIDPipe) id: string): DeviceView {
    return this.devices.connect(id);
  }

  @Post(':id/disconnect')
  @HttpCode(HttpStatus.OK)
  disconnect(@Param('id', ParseUUIDPipe) id: string): Promise<DeviceView> {
    return this.devices.disconnect(id);
  }

  @Post(':id/payment')
  @HttpCode(HttpStatus.OK)
  payment(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SendPaymentDto): DeviceView {
    return this.devices.act(id, (t) => t.sendPayment(dto.amountTetri, dto.result));
  }

  @Post(':id/status')
  @HttpCode(HttpStatus.OK)
  status(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SendStatusDto): DeviceView {
    return this.devices.act(id, (t) => t.sendStatus(dto.status));
  }

  @Post(':id/operation')
  @HttpCode(HttpStatus.OK)
  operation(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SendOperationDto): DeviceView {
    return this.devices.act(id, (t) => t.sendOperation(dto.vid, dto.result, dto.amountTetri));
  }

  @Post(':id/raw')
  @HttpCode(HttpStatus.OK)
  raw(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SendRawDto): DeviceView {
    return this.devices.act(id, (t) => t.sendRaw(dto.hex.replace(/\s+/g, '')));
  }

  /** Answer a pending 0x50 / 0x51 (manual mode, or to beat the auto timer). */
  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  complete(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CompleteDto): DeviceView {
    return this.devices.act(id, (t) => t.complete(dto.result));
  }

  @Get(':id/frames')
  frames(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit', new DefaultValuePipe(300), ParseIntPipe) limit: number,
  ): FrameEntry[] {
    return this.devices.frameLog(id, Math.min(Math.max(limit, 1), 1000));
  }

  @Delete(':id/frames')
  @HttpCode(HttpStatus.NO_CONTENT)
  clearFrames(@Param('id', ParseUUIDPipe) id: string): void {
    this.devices.clearFrameLog(id);
  }
}

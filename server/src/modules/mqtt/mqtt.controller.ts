import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../../shared/decorators/api-auth.decorator';
import { PaginatedResult } from '../../shared/dto/paginated-result.dto';
import { UserRole } from '../../shared/enums/user-role.enum';
import { DeviceMessageService } from './device-message.service';
import {
  ListMessagesQueryDto,
  PublishCommandDto,
  SimulateMessageDto,
} from './dto/simulate-message.dto';
import { DeviceMessage } from './entities/device-message.entity';
import { PayloadField } from './frame.codec';
import { MqttRouterService, RouterStats } from './mqtt-router.service';
import { MqttService, MqttStatus } from './mqtt.service';
import { commandTopic } from './mqtt-topic.util';
import { ConfigService } from '@nestjs/config';
import { MqttConfig } from '../../config/configuration';

@ApiTags('mqtt')
@Controller('mqtt')
export class MqttController {
  private readonly config: MqttConfig;

  constructor(
    private readonly mqtt: MqttService,
    private readonly router: MqttRouterService,
    private readonly messages: DeviceMessageService,
    config: ConfigService,
  ) {
    this.config = config.getOrThrow<MqttConfig>('mqtt');
  }

  @Get('status')
  @Auth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Broker connection state and dispatch counters' })
  status(): MqttStatus & { router: RouterStats } {
    return { ...this.mqtt.getStatus(), router: this.router.getStats() };
  }

  @Get('messages')
  @Auth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Raw inbound frame log' })
  messageLog(@Query() query: ListMessagesQueryDto): Promise<PaginatedResult<DeviceMessage>> {
    return this.messages.list(query);
  }

  @Post('simulate')
  @Auth(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Feed a frame through the pipeline without a device or broker',
    description:
      'Decodes, registers unknown ids, runs the handler and books the payment exactly as a real frame would. The fastest way to verify tariffs and the earnings charts.',
  })
  async simulate(@Body() dto: SimulateMessageDto): Promise<{ topic: string; dispatched: true }> {
    const event = dto.event ?? 'payment';
    const topic = `${this.config.rootTopic}/${dto.deviceUid}/events/${event}`;
    const buffer = dto.payloadHex
      ? Buffer.from(dto.payloadHex.replace(/\s+/g, ''), 'hex')
      : Buffer.from(JSON.stringify(dto.payload ?? {}), 'utf8');

    await this.router.dispatch(topic, buffer);
    return { topic, dispatched: true };
  }

  @Post('publish')
  @Auth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Send a command frame to a terminal' })
  async publish(@Body() dto: PublishCommandDto): Promise<{ topic: string; sent: true }> {
    await this.mqtt.publishCommand(
      dto.deviceUid,
      dto.command,
      (dto.fields ?? []) as PayloadField[],
    );
    return { topic: commandTopic(this.config.rootTopic, dto.deviceUid), sent: true };
  }
}

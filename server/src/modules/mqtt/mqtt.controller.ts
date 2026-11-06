import { BadRequestException, Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../../shared/decorators/api-auth.decorator';
import { PaginatedResult } from '../../shared/dto/paginated-result.dto';
import { ALL_ROLES, UserRole } from '../../shared/enums/user-role.enum';
import { DeviceMessageService } from './device-message.service';
import {
  ListMessagesQueryDto,
  PublishCommandDto,
  SimulateMessageDto,
} from './dto/simulate-message.dto';
import { DeviceMessage } from './entities/device-message.entity';
import { FrameCodec, PayloadField } from './frame.codec';
import { MqttRouterService, RouterStats } from './mqtt-router.service';
import { MqttService, MqttStatus } from './mqtt.service';
import { commandTopic } from './mqtt-topic.util';
import { ConfigService } from '@nestjs/config';
import { MqttConfig } from '../../config/configuration';
import {
  OPERATION_MODE_LABELS,
  OPERATION_RESULT_LABELS,
  VALUE_BYTE_ORDER,
  VID_DEFINITIONS,
} from './protocol/terminal-protocol';

@ApiTags('mqtt')
@Controller('mqtt')
export class MqttController {
  private readonly config: MqttConfig;

  constructor(
    private readonly mqtt: MqttService,
    private readonly router: MqttRouterService,
    private readonly messages: DeviceMessageService,
    private readonly codec: FrameCodec,
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

  @Get('protocol')
  @Auth(...ALL_ROLES)
  @ApiOperation({
    summary: 'The terminal VID protocol: every config, command and event with its range',
    description: 'What config forms are built from, and the reference for firmware work.',
  })
  protocol() {
    return {
      valueByteOrder: VALUE_BYTE_ORDER,
      vids: VID_DEFINITIONS,
      operationResults: OPERATION_RESULT_LABELS,
      operationModes: OPERATION_MODE_LABELS,
    };
  }

  @Post('simulate')
  @Auth(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Feed a frame through the pipeline without a device or broker',
    description:
      'Decodes, registers unknown ids, runs the handler and books the payment exactly as a real frame would. The fastest way to verify tariffs and the earnings charts.',
  })
  async simulate(@Body() dto: SimulateMessageDto): Promise<{ topic: string; dispatched: true }> {
    // Terminal frames route by VID, so their topic segment is only cosmetic.
    const event = dto.event ?? (dto.records ? 'general' : 'payment');
    const topic = `${this.config.rootTopic}/${dto.deviceUid}/events/${event}`;
    const buffer = dto.records
      ? this.encodeSimulated(dto.records)
      : dto.payloadHex
        ? Buffer.from(dto.payloadHex.replace(/\s+/g, ''), 'hex')
        : Buffer.from(JSON.stringify(dto.payload ?? {}), 'utf8');

    await this.router.dispatch(topic, buffer);
    return { topic, dispatched: true };
  }

  /** Out-of-range values are refused here; send a malformed frame as payloadHex instead. */
  private encodeSimulated(records: SimulateMessageDto['records'] & object): Buffer {
    try {
      return this.codec.encodeRecords(records, { allowEvents: true });
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
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

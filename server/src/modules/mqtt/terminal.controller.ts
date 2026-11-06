import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../../shared/decorators/api-auth.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { ALL_ROLES, UserRole } from '../../shared/enums/user-role.enum';
import { AuthenticatedUser } from '../../shared/interfaces/authenticated-user.interface';
import { DevicesService } from '../devices/devices.service';
import { SetAmountDto, UpdateTerminalConfigDto } from './dto/terminal.dto';
import {
  CommandSent,
  ConfigPushResult,
  TerminalCommandsService,
  TerminalConfigView,
} from './terminal-commands.service';

/**
 * Terminal config and commands, under /devices/:id. Lives in the mqtt
 * module because it publishes, and devices must not depend on mqtt.
 */
@ApiTags('devices')
@Controller('devices')
export class TerminalController {
  constructor(
    private readonly devices: DevicesService,
    private readonly terminal: TerminalCommandsService,
  ) {}

  @Get(':id/config')
  @Auth(...ALL_ROLES)
  @ApiOperation({ summary: 'Terminal config (VIDs 0x01-0x08), spec defaults filled in' })
  async config(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TerminalConfigView> {
    return this.terminal.describeConfig(await this.devices.findOneScoped(user, id));
  }

  @Patch(':id/config')
  @Auth(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Change terminal config and push it',
    description:
      'Saves the merged config, then sends all of it in one frame. `delivered: false` means saved but not sent (broker unreachable); retry with POST :id/config/push.',
  })
  async updateConfig(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTerminalConfigDto,
  ): Promise<ConfigPushResult> {
    return this.terminal.updateConfig(await this.devices.findOneScoped(user, id), dto);
  }

  @Post(':id/config/push')
  @Auth(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend the saved config, e.g. after a terminal swap or reset' })
  async pushConfig(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ConfigPushResult> {
    return this.terminal.pushConfig(await this.devices.findOneScoped(user, id));
  }

  @Post(':id/commands/amount')
  @Auth(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tell the terminal to charge an amount (VID 0x50)' })
  async setAmount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetAmountDto,
  ): Promise<CommandSent> {
    return this.terminal.setAmount(await this.devices.findOneScoped(user, id), dto.amountTetri);
  }

  @Post(':id/commands/reconcile')
  @Auth(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Run terminal reconciliation (VID 0x51)',
    description: 'The result comes back as event 0xBB, kept in terminalState.lastReconciliation.',
  })
  async reconcile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CommandSent> {
    return this.terminal.reconcile(await this.devices.findOneScoped(user, id));
  }
}

import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../../shared/decorators/api-auth.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { ALL_ROLES } from '../../shared/enums/user-role.enum';
import { AuthenticatedUser } from '../../shared/interfaces/authenticated-user.interface';
import { EarningsQueryDto } from './dto/earnings-query.dto';
import { EarningsSeriesDto } from './dto/earnings-series.dto';
import { EarningsScopeService } from './earnings-scope.service';
import { EarningsService } from './earnings.service';

@ApiTags('earnings')
@Controller('earnings')
export class EarningsController {
  constructor(
    private readonly earnings: EarningsService,
    private readonly scope: EarningsScopeService,
  ) {}

  @Get()
  @Auth(...ALL_ROLES)
  @ApiOperation({
    summary: 'Monthly earnings series for the caller scope',
    description:
      'Feeds the three column charts: gross income, Eideas commission, and the company net (gross - commission) per month.',
  })
  async series(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: EarningsQueryDto,
  ): Promise<EarningsSeriesDto> {
    const scope = await this.scope.resolve(user, query);
    return this.earnings.monthlySeries(scope, query);
  }

  @Get('devices/:deviceId')
  @Auth(...ALL_ROLES)
  @ApiOperation({ summary: 'Monthly earnings series of one device/terminal' })
  async deviceSeries(
    @CurrentUser() user: AuthenticatedUser,
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
    @Query() query: EarningsQueryDto,
  ): Promise<EarningsSeriesDto> {
    const scope = await this.scope.resolve(user, { ...query, deviceId });
    return this.earnings.monthlySeries(scope, query);
  }

  @Get('sites/:siteId')
  @Auth(...ALL_ROLES)
  @ApiOperation({ summary: 'Monthly earnings series of one object/site' })
  async siteSeries(
    @CurrentUser() user: AuthenticatedUser,
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Query() query: EarningsQueryDto,
  ): Promise<EarningsSeriesDto> {
    const scope = await this.scope.resolve(user, { ...query, siteId });
    return this.earnings.monthlySeries(scope, query);
  }
}

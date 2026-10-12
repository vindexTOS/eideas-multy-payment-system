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
import { ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { Auth } from '../../shared/decorators/api-auth.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { PaginatedResult } from '../../shared/dto/paginated-result.dto';
import { PaginationQueryDto } from '../../shared/dto/pagination-query.dto';
import { ALL_ROLES, UserRole } from '../../shared/enums/user-role.enum';
import { AuthenticatedUser } from '../../shared/interfaces/authenticated-user.interface';
import { CreateSiteDto } from './dto/create-site.dto';
import { SiteSummaryDto } from './dto/site-summary.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { Site } from './entities/site.entity';
import { SitesService } from './sites.service';

class ListSitesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Admin only - filter by company' })
  @IsOptional()
  @IsUUID()
  companyId?: string;
}

/** "Objects" in the client wording: the addresses a company operates. */
@ApiTags('sites')
@Controller('sites')
export class SitesController {
  constructor(private readonly sites: SitesService) {}

  @Get()
  @Auth(...ALL_ROLES)
  @ApiOperation({ summary: 'List objects visible to the caller' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListSitesQueryDto,
  ): Promise<PaginatedResult<SiteSummaryDto>> {
    return this.sites.list(user, query);
  }

  @Get(':id')
  @Auth(...ALL_ROLES)
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Site> {
    return this.sites.findOneScoped(user, id);
  }

  @Post()
  @Auth(UserRole.ADMIN, UserRole.COMPANY)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSiteDto): Promise<Site> {
    return this.sites.create(user, dto);
  }

  @Patch(':id')
  @Auth(UserRole.ADMIN, UserRole.COMPANY)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSiteDto,
  ): Promise<Site> {
    return this.sites.update(user, id, dto);
  }

  @Delete(':id')
  @Auth(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.sites.remove(user, id);
  }
}

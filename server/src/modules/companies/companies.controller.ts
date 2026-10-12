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
import { PaginationQueryDto } from '../../shared/dto/pagination-query.dto';
import { ALL_ROLES, UserRole } from '../../shared/enums/user-role.enum';
import { AuthenticatedUser } from '../../shared/interfaces/authenticated-user.interface';
import { CompaniesService } from './companies.service';
import { CompanySummaryDto } from './dto/company-summary.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { Company } from './entities/company.entity';

@ApiTags('companies')
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Get()
  @Auth(...ALL_ROLES)
  @ApiOperation({
    summary: 'List companies (admin landing page)',
    description: 'Company users only ever see their own row.',
  })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResult<CompanySummaryDto>> {
    return this.companies.summaryList(user, query);
  }

  @Get(':id')
  @Auth(...ALL_ROLES)
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Company> {
    return this.companies.findOneScoped(user, id);
  }

  @Post()
  @Auth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a company (admin only)' })
  create(@Body() dto: CreateCompanyDto): Promise<Company> {
    return this.companies.create(dto);
  }

  @Patch(':id')
  @Auth(UserRole.ADMIN)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCompanyDto): Promise<Company> {
    return this.companies.update(id, dto);
  }

  @Delete(':id')
  @Auth(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a company (payment history is kept)' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.companies.remove(id);
  }
}

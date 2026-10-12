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
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { Auth } from '../../shared/decorators/api-auth.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { PaginatedResult } from '../../shared/dto/paginated-result.dto';
import { PaginationQueryDto } from '../../shared/dto/pagination-query.dto';
import { UserRole } from '../../shared/enums/user-role.enum';
import { AuthenticatedUser } from '../../shared/interfaces/authenticated-user.interface';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';

class ListUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Admin only - filter by company' })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Auth(UserRole.ADMIN, UserRole.COMPANY)
  @ApiOperation({
    summary: 'List accounts',
    description: 'A company sees only its own staff; an admin sees everyone.',
  })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListUsersQueryDto,
  ): Promise<PaginatedResult<UserResponseDto>> {
    return this.users.list(user, query);
  }

  @Get(':id')
  @Auth(UserRole.ADMIN, UserRole.COMPANY)
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserResponseDto> {
    return this.users.findOneScoped(user, id);
  }

  @Post()
  @Auth(UserRole.ADMIN, UserRole.COMPANY)
  @ApiOperation({
    summary: 'Create an account',
    description:
      'A company can create manager accounts for its own devices. Only an admin can create admin or company accounts.',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateUserDto,
  ): Promise<UserResponseDto> {
    return this.users.create(user, dto);
  }

  @Patch(':id')
  @Auth(UserRole.ADMIN, UserRole.COMPANY)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.users.update(user, id, dto);
  }

  @Delete(':id')
  @Auth(UserRole.ADMIN, UserRole.COMPANY)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.users.remove(user, id);
  }
}

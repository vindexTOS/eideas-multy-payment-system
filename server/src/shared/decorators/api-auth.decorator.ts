import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { UserRole } from '../enums/user-role.enum';
import { Roles } from './roles.decorator';

/** `@Auth(UserRole.ADMIN)` = role guard + the swagger paperwork in one line. */
export const Auth = (...roles: UserRole[]) =>
  applyDecorators(
    Roles(...roles),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'Missing or invalid access token' }),
    ApiForbiddenResponse({ description: 'Role or company scope does not allow this' }),
  );

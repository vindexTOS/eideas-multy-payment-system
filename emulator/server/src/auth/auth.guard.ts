import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { IS_PUBLIC } from './public.decorator';

/**
 * Global: every route needs the super-admin session unless marked @Public().
 * The event stream may carry the token as `?access_token=`, because the
 * browser's EventSource cannot send headers.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { session?: unknown }>();
    const header = request.headers.authorization;
    const fromHeader = header?.startsWith('Bearer ') ? header.slice(7) : null;
    const fromQuery =
      request.path.endsWith('/stream') && typeof request.query.access_token === 'string'
        ? request.query.access_token
        : null;
    const token = fromHeader ?? fromQuery;
    if (!token) throw new UnauthorizedException('Sign in as the emulator super admin');

    request.session = await this.auth.verify(token);
    return true;
  }
}

import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { IsString, MaxLength } from 'class-validator';
import { AuthService, Session } from './auth.service';
import { Public } from './public.decorator';

class LoginDto {
  @IsString()
  @MaxLength(320)
  email: string;

  @IsString()
  @MaxLength(200)
  password: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<{ accessToken: string; email: string }> {
    return this.auth.login(dto.email, dto.password);
  }

  @Get('me')
  me(@Req() request: { session: Session }): Session {
    return request.session;
  }
}

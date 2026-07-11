import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { REQUIRE_PLATFORM_STEP_UP_KEY } from '../decorators/require-platform-step-up.decorator';
import type { PlatformAdminUser } from '../interfaces/platform-admin-user.interface';

interface PlatformRequest extends Request {
  platformAdmin?: PlatformAdminUser;
}

interface PlatformStepUpPayload {
  sub: string;
  sid: string;
  kind: 'platform_step_up';
}

@Injectable()
export class PlatformStepUpGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<boolean>(REQUIRE_PLATFORM_STEP_UP_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) {
      return true;
    }

    const request = context.switchToHttp().getRequest<PlatformRequest>();
    const currentUser = request.platformAdmin;
    if (!currentUser) {
      throw new UnauthorizedException('Platform authentication is required');
    }

    const token = request.header('x-platform-step-up-token');
    if (!token) {
      throw new UnauthorizedException('Step-up token is required');
    }

    try {
      const secret = this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
      const payload = await this.jwtService.verifyAsync<PlatformStepUpPayload>(token, { secret });
      if (payload.kind !== 'platform_step_up') {
        throw new UnauthorizedException('Invalid step-up token');
      }
      if (payload.sub !== currentUser.id || payload.sid !== currentUser.sessionId) {
        throw new UnauthorizedException('Step-up token does not match current session');
      }
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired step-up token');
    }
  }
}

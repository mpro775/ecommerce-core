import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { PlatformAccessTokenPayload } from '../interfaces/platform-access-token-payload.interface';
import type { PlatformAdminUser } from '../interfaces/platform-admin-user.interface';
import { PlatformAuthRepository } from '../platform-auth.repository';

interface PlatformAuthenticatedRequest extends Request {
  platformAdmin?: PlatformAdminUser;
}

@Injectable()
export class PlatformAccessTokenGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly platformAuthRepository: PlatformAuthRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<PlatformAuthenticatedRequest>();
    const token = this.extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException('Platform access token is required');
    }

    const payload = await this.verifyToken(token);
    if (payload.kind !== 'platform_admin') {
      throw new UnauthorizedException('Invalid platform access token');
    }

    await this.assertLiveSessionAndAdmin(payload);

    request.platformAdmin = {
      id: payload.sub,
      email: payload.email,
      fullName: payload.fullName,
      status: 'active',
      mfaEnabled: payload.mfaEnabled,
      permissions: payload.permissions,
      roleCodes: payload.roleCodes,
      sessionId: payload.sid,
    };

    return true;
  }

  private extractBearerToken(request: Request): string | null {
    const authHeader = request.header('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return null;
    }

    return authHeader.slice(7).trim();
  }

  private async verifyToken(token: string): Promise<PlatformAccessTokenPayload> {
    try {
      const secret = this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
      return await this.jwtService.verifyAsync<PlatformAccessTokenPayload>(token, { secret });
    } catch {
      throw new UnauthorizedException('Invalid or expired platform access token');
    }
  }

  private async assertLiveSessionAndAdmin(payload: PlatformAccessTokenPayload): Promise<void> {
    const session = await this.platformAuthRepository.findSessionById(payload.sid);
    if (!session || session.admin_user_id !== payload.sub || session.revoked_at) {
      throw new UnauthorizedException('Platform session is invalid');
    }
    if (session.expires_at.getTime() <= Date.now()) {
      throw new UnauthorizedException('Platform session has expired');
    }

    const admin = await this.platformAuthRepository.findAdminById(payload.sub);
    if (!admin || admin.status !== 'active') {
      throw new UnauthorizedException('Platform admin account is not active');
    }
  }
}

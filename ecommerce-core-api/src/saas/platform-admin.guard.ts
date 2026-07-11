import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ header: (name: string) => string | undefined }>();
    const expectedSecret = this.configService.get<string>('PLATFORM_ADMIN_SECRET', '').trim();
    if (!expectedSecret) {
      throw new UnauthorizedException('Platform admin secret is not configured');
    }

    const provided = request.header('x-platform-admin-secret')?.trim();
    if (!provided || provided !== expectedSecret) {
      throw new UnauthorizedException('Invalid platform admin secret');
    }

    return true;
  }
}

import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PLATFORM_REQUIRED_PERMISSIONS_KEY } from '../decorators/require-platform-permissions.decorator';
import type { PlatformAdminUser } from '../interfaces/platform-admin-user.interface';

@Injectable()
export class PlatformPermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PLATFORM_REQUIRED_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ platformAdmin?: PlatformAdminUser }>();

    const user = request.platformAdmin;
    if (!user) {
      throw new ForbiddenException('Platform admin authentication is required');
    }

    if (user.roleCodes.includes('super_admin') || user.permissions.includes('*')) {
      return true;
    }

    const hasAll = required.every((permission) => user.permissions.includes(permission));

    if (!hasAll) {
      throw new ForbiddenException('Insufficient platform permissions');
    }

    return true;
  }
}

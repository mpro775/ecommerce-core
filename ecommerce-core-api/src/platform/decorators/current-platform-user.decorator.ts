import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { PlatformAdminUser } from '../interfaces/platform-admin-user.interface';

export const CurrentPlatformUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): PlatformAdminUser | undefined => {
    const request = context.switchToHttp().getRequest<{ platformAdmin?: PlatformAdminUser }>();
    return request.platformAdmin;
  },
);

import { SetMetadata } from '@nestjs/common';

export const PLATFORM_REQUIRED_PERMISSIONS_KEY = 'platform_required_permissions';

export const RequirePlatformPermissions = (...permissions: string[]) =>
  SetMetadata(PLATFORM_REQUIRED_PERMISSIONS_KEY, permissions);

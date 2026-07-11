import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PLATFORM_STEP_UP_KEY = 'requirePlatformStepUp';

export const RequirePlatformStepUp = () => SetMetadata(REQUIRE_PLATFORM_STEP_UP_KEY, true);

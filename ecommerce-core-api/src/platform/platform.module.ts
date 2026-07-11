import { Module } from '@nestjs/common';
import { SecurityModule } from '../security/security.module';
import { PlatformAuthController } from './platform-auth.controller';
import { PlatformAuthRepository } from './platform-auth.repository';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformAccessTokenGuard } from './guards/platform-access-token.guard';
import { PlatformPermissionsGuard } from './guards/platform-permissions.guard';
import { PlatformStepUpGuard } from './guards/platform-step-up.guard';

@Module({
  imports: [SecurityModule],
  controllers: [PlatformAuthController],
  providers: [
    PlatformAuthRepository,
    PlatformAuthService,
    PlatformAccessTokenGuard,
    PlatformPermissionsGuard,
    PlatformStepUpGuard,
  ],
  exports: [
    PlatformAuthRepository,
    PlatformAuthService,
    PlatformAccessTokenGuard,
    PlatformPermissionsGuard,
    PlatformStepUpGuard,
  ],
})
export class PlatformModule {}

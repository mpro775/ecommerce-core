import { Module } from '@nestjs/common';
import { PlatformModule } from '../../platform/platform.module';
import { SaasService } from '../../saas/saas.service';
import { PlatformAdminFacade } from '../facade/platform-admin.facade';
import { PlatformAdminFacadeModule } from '../facade/platform-admin-facade.module';
import { PlatformOperationsController } from './platform-operations.controller';

@Module({
  imports: [PlatformAdminFacadeModule, PlatformModule],
  controllers: [PlatformOperationsController],
  providers: [
    {
      provide: SaasService,
      useExisting: PlatformAdminFacade,
    },
  ],
})
export class PlatformOperationsModule {}

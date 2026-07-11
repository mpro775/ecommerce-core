import { Module } from '@nestjs/common';
import { PlatformModule } from '../../platform/platform.module';
import { SaasService } from '../../saas/saas.service';
import { PlatformAdminFacade } from '../facade/platform-admin.facade';
import { PlatformAdminFacadeModule } from '../facade/platform-admin-facade.module';
import { PlatformBillingController } from './platform-billing.controller';

@Module({
  imports: [PlatformAdminFacadeModule, PlatformModule],
  controllers: [PlatformBillingController],
  providers: [
    {
      provide: SaasService,
      useExisting: PlatformAdminFacade,
    },
  ],
})
export class PlatformBillingModule {}

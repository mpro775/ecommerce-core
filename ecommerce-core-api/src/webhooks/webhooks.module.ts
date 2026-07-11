import { Module } from '@nestjs/common';
import { SaasModule } from '../saas/saas.module';
import { SecurityModule } from '../security/security.module';
import { WebhooksController } from './webhooks.controller';
import { WebhooksRepository } from './webhooks.repository';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [SecurityModule, SaasModule],
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhooksRepository],
  exports: [WebhooksService],
})
export class WebhooksModule {}

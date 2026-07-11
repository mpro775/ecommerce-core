import { Module } from '@nestjs/common';
import { SaasModule } from '../saas/saas.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { LoyaltyController } from './loyalty.controller';
import { LoyaltyRepository } from './loyalty.repository';
import { LoyaltyService } from './loyalty.service';

@Module({
  imports: [WebhooksModule, SaasModule],
  controllers: [LoyaltyController],
  providers: [LoyaltyRepository, LoyaltyService],
  exports: [LoyaltyRepository, LoyaltyService],
})
export class LoyaltyModule {}

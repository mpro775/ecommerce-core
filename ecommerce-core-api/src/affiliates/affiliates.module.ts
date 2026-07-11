import { Module } from '@nestjs/common';
import { SecurityModule } from '../security/security.module';
import { SaasModule } from '../saas/saas.module';
import { AffiliatesController } from './affiliates.controller';
import { AffiliatesRepository } from './affiliates.repository';
import { AffiliatesService } from './affiliates.service';

@Module({
  imports: [SecurityModule, SaasModule],
  controllers: [AffiliatesController],
  providers: [AffiliatesRepository, AffiliatesService],
  exports: [AffiliatesRepository, AffiliatesService],
})
export class AffiliatesModule {}

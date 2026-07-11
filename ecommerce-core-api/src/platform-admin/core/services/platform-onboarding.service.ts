import { Injectable } from '@nestjs/common';
import { SaasService } from '../../../saas/saas.service';

@Injectable()
export class PlatformOnboardingService {
  constructor(private readonly saasService: SaasService) {}

  getPlatformOnboardingPipeline(
    ...args: Parameters<SaasService['getPlatformOnboardingPipeline']>
  ): ReturnType<SaasService['getPlatformOnboardingPipeline']> {
    return this.saasService.getPlatformOnboardingPipeline(...args);
  }

  getPlatformOnboardingStuckStores(
    ...args: Parameters<SaasService['getPlatformOnboardingStuckStores']>
  ): ReturnType<SaasService['getPlatformOnboardingStuckStores']> {
    return this.saasService.getPlatformOnboardingStuckStores(...args);
  }
}

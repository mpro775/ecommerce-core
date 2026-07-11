import { Injectable } from '@nestjs/common';
import { SaasService } from '../../../saas/saas.service';

@Injectable()
export class PlatformSettingsService {
  constructor(private readonly saasService: SaasService) {}

  getPlatformSettings(
    ...args: Parameters<SaasService['getPlatformSettings']>
  ): ReturnType<SaasService['getPlatformSettings']> {
    return this.saasService.getPlatformSettings(...args);
  }

  updatePlatformSettings(
    ...args: Parameters<SaasService['updatePlatformSettings']>
  ): ReturnType<SaasService['updatePlatformSettings']> {
    return this.saasService.updatePlatformSettings(...args);
  }
}

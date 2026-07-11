import { Injectable } from '@nestjs/common';
import { SaasService } from '../../../saas/saas.service';

@Injectable()
export class PlatformSupportService {
  constructor(private readonly saasService: SaasService) {}

  listPlatformSupportCases(
    ...args: Parameters<SaasService['listPlatformSupportCases']>
  ): ReturnType<SaasService['listPlatformSupportCases']> {
    return this.saasService.listPlatformSupportCases(...args);
  }

  createPlatformSupportCase(
    ...args: Parameters<SaasService['createPlatformSupportCase']>
  ): ReturnType<SaasService['createPlatformSupportCase']> {
    return this.saasService.createPlatformSupportCase(...args);
  }

  updatePlatformSupportCase(
    ...args: Parameters<SaasService['updatePlatformSupportCase']>
  ): ReturnType<SaasService['updatePlatformSupportCase']> {
    return this.saasService.updatePlatformSupportCase(...args);
  }
}

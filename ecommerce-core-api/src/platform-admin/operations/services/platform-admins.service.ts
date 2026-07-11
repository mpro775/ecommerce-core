import { Injectable } from '@nestjs/common';
import { SaasService } from '../../../saas/saas.service';

@Injectable()
export class PlatformAdminsService {
  constructor(private readonly saasService: SaasService) {}

  listPlatformAdmins(
    ...args: Parameters<SaasService['listPlatformAdmins']>
  ): ReturnType<SaasService['listPlatformAdmins']> {
    return this.saasService.listPlatformAdmins(...args);
  }

  createPlatformAdmin(
    ...args: Parameters<SaasService['createPlatformAdmin']>
  ): ReturnType<SaasService['createPlatformAdmin']> {
    return this.saasService.createPlatformAdmin(...args);
  }

  updatePlatformAdmin(
    ...args: Parameters<SaasService['updatePlatformAdmin']>
  ): ReturnType<SaasService['updatePlatformAdmin']> {
    return this.saasService.updatePlatformAdmin(...args);
  }
}

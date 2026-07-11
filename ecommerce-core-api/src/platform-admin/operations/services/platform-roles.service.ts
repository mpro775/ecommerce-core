import { Injectable } from '@nestjs/common';
import { SaasService } from '../../../saas/saas.service';

@Injectable()
export class PlatformRolesService {
  constructor(private readonly saasService: SaasService) {}

  listPlatformRoles(
    ...args: Parameters<SaasService['listPlatformRoles']>
  ): ReturnType<SaasService['listPlatformRoles']> {
    return this.saasService.listPlatformRoles(...args);
  }

  createPlatformRole(
    ...args: Parameters<SaasService['createPlatformRole']>
  ): ReturnType<SaasService['createPlatformRole']> {
    return this.saasService.createPlatformRole(...args);
  }

  updatePlatformRole(
    ...args: Parameters<SaasService['updatePlatformRole']>
  ): ReturnType<SaasService['updatePlatformRole']> {
    return this.saasService.updatePlatformRole(...args);
  }
}

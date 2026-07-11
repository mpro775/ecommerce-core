import { Injectable } from '@nestjs/common';
import { SaasService } from '../../../saas/saas.service';

@Injectable()
export class PlatformComplianceService {
  constructor(private readonly saasService: SaasService) {}

  listPlatformComplianceTasks(
    ...args: Parameters<SaasService['listPlatformComplianceTasks']>
  ): ReturnType<SaasService['listPlatformComplianceTasks']> {
    return this.saasService.listPlatformComplianceTasks(...args);
  }

  createPlatformComplianceTask(
    ...args: Parameters<SaasService['createPlatformComplianceTask']>
  ): ReturnType<SaasService['createPlatformComplianceTask']> {
    return this.saasService.createPlatformComplianceTask(...args);
  }

  updatePlatformComplianceTaskStatus(
    ...args: Parameters<SaasService['updatePlatformComplianceTaskStatus']>
  ): ReturnType<SaasService['updatePlatformComplianceTaskStatus']> {
    return this.saasService.updatePlatformComplianceTaskStatus(...args);
  }
}

import { Injectable } from '@nestjs/common';
import { SaasService } from '../../../saas/saas.service';

@Injectable()
export class PlatformRiskService {
  constructor(private readonly saasService: SaasService) {}

  listPlatformRiskViolations(
    ...args: Parameters<SaasService['listPlatformRiskViolations']>
  ): ReturnType<SaasService['listPlatformRiskViolations']> {
    return this.saasService.listPlatformRiskViolations(...args);
  }

  createPlatformRiskViolation(
    ...args: Parameters<SaasService['createPlatformRiskViolation']>
  ): ReturnType<SaasService['createPlatformRiskViolation']> {
    return this.saasService.createPlatformRiskViolation(...args);
  }

  updatePlatformRiskViolationStatus(
    ...args: Parameters<SaasService['updatePlatformRiskViolationStatus']>
  ): ReturnType<SaasService['updatePlatformRiskViolationStatus']> {
    return this.saasService.updatePlatformRiskViolationStatus(...args);
  }
}

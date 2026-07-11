import { Injectable } from '@nestjs/common';
import { SaasService } from '../../../saas/saas.service';

@Injectable()
export class PlatformAutomationService {
  constructor(private readonly saasService: SaasService) {}

  listPlatformAutomationRules(
    ...args: Parameters<SaasService['listPlatformAutomationRules']>
  ): ReturnType<SaasService['listPlatformAutomationRules']> {
    return this.saasService.listPlatformAutomationRules(...args);
  }

  createPlatformAutomationRule(
    ...args: Parameters<SaasService['createPlatformAutomationRule']>
  ): ReturnType<SaasService['createPlatformAutomationRule']> {
    return this.saasService.createPlatformAutomationRule(...args);
  }

  updatePlatformAutomationRuleStatus(
    ...args: Parameters<SaasService['updatePlatformAutomationRuleStatus']>
  ): ReturnType<SaasService['updatePlatformAutomationRuleStatus']> {
    return this.saasService.updatePlatformAutomationRuleStatus(...args);
  }

  triggerPlatformAutomationRule(
    ...args: Parameters<SaasService['triggerPlatformAutomationRule']>
  ): ReturnType<SaasService['triggerPlatformAutomationRule']> {
    return this.saasService.triggerPlatformAutomationRule(...args);
  }

  listPlatformAutomationRuns(
    ...args: Parameters<SaasService['listPlatformAutomationRuns']>
  ): ReturnType<SaasService['listPlatformAutomationRuns']> {
    return this.saasService.listPlatformAutomationRuns(...args);
  }
}

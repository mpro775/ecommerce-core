import { Injectable } from '@nestjs/common';
import { SaasService } from '../../../saas/saas.service';

@Injectable()
export class PlatformSubscriptionsService {
  constructor(private readonly saasService: SaasService) {}

  assignStorePlan(
    ...args: Parameters<SaasService['assignStorePlan']>
  ): ReturnType<SaasService['assignStorePlan']> {
    return this.saasService.assignStorePlan(...args);
  }

  listPlatformSubscriptions(
    ...args: Parameters<SaasService['listPlatformSubscriptions']>
  ): ReturnType<SaasService['listPlatformSubscriptions']> {
    return this.saasService.listPlatformSubscriptions(...args);
  }

  cancelSubscription(
    ...args: Parameters<SaasService['cancelSubscription']>
  ): ReturnType<SaasService['cancelSubscription']> {
    return this.saasService.cancelSubscription(...args);
  }

  suspendSubscription(
    ...args: Parameters<SaasService['suspendSubscription']>
  ): ReturnType<SaasService['suspendSubscription']> {
    return this.saasService.suspendSubscription(...args);
  }

  resumeSubscription(
    ...args: Parameters<SaasService['resumeSubscription']>
  ): ReturnType<SaasService['resumeSubscription']> {
    return this.saasService.resumeSubscription(...args);
  }

  canDowngradePlan(
    ...args: Parameters<SaasService['canDowngradePlan']>
  ): ReturnType<SaasService['canDowngradePlan']> {
    return this.saasService.canDowngradePlan(...args);
  }
}

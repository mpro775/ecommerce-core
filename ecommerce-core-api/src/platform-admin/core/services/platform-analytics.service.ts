import { Injectable } from '@nestjs/common';
import { SaasService } from '../../../saas/saas.service';

@Injectable()
export class PlatformAnalyticsService {
  constructor(private readonly saasService: SaasService) {}

  getPlatformAnalyticsOverview(
    ...args: Parameters<SaasService['getPlatformAnalyticsOverview']>
  ): ReturnType<SaasService['getPlatformAnalyticsOverview']> {
    return this.saasService.getPlatformAnalyticsOverview(...args);
  }

  getPlatformAnalyticsMrrChurn(
    ...args: Parameters<SaasService['getPlatformAnalyticsMrrChurn']>
  ): ReturnType<SaasService['getPlatformAnalyticsMrrChurn']> {
    return this.saasService.getPlatformAnalyticsMrrChurn(...args);
  }

  getPlatformAnalyticsCohorts(
    ...args: Parameters<SaasService['getPlatformAnalyticsCohorts']>
  ): ReturnType<SaasService['getPlatformAnalyticsCohorts']> {
    return this.saasService.getPlatformAnalyticsCohorts(...args);
  }

  getPlatformAnalyticsFunnel(
    ...args: Parameters<SaasService['getPlatformAnalyticsFunnel']>
  ): ReturnType<SaasService['getPlatformAnalyticsFunnel']> {
    return this.saasService.getPlatformAnalyticsFunnel(...args);
  }
}

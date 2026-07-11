import { Injectable } from '@nestjs/common';
import { SaasService } from '../../../saas/saas.service';

@Injectable()
export class PlatformFinanceService {
  constructor(private readonly saasService: SaasService) {}

  getPlatformFinanceOverview(
    ...args: Parameters<SaasService['getPlatformFinanceOverview']>
  ): ReturnType<SaasService['getPlatformFinanceOverview']> {
    return this.saasService.getPlatformFinanceOverview(...args);
  }

  listPlatformFinanceAging(
    ...args: Parameters<SaasService['listPlatformFinanceAging']>
  ): ReturnType<SaasService['listPlatformFinanceAging']> {
    return this.saasService.listPlatformFinanceAging(...args);
  }

  listPlatformFinanceCollections(
    ...args: Parameters<SaasService['listPlatformFinanceCollections']>
  ): ReturnType<SaasService['listPlatformFinanceCollections']> {
    return this.saasService.listPlatformFinanceCollections(...args);
  }

  listPlatformBillingEvents(
    ...args: Parameters<SaasService['listPlatformBillingEvents']>
  ): ReturnType<SaasService['listPlatformBillingEvents']> {
    return this.saasService.listPlatformBillingEvents(...args);
  }
}

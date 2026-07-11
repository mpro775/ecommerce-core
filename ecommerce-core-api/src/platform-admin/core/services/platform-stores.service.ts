import { Injectable } from '@nestjs/common';
import { SaasService } from '../../../saas/saas.service';

@Injectable()
export class PlatformStoresService {
  constructor(private readonly saasService: SaasService) {}

  listPlatformStores(
    ...args: Parameters<SaasService['listPlatformStores']>
  ): ReturnType<SaasService['listPlatformStores']> {
    return this.saasService.listPlatformStores(...args);
  }

  getPlatformStoreById(
    ...args: Parameters<SaasService['getPlatformStoreById']>
  ): ReturnType<SaasService['getPlatformStoreById']> {
    return this.saasService.getPlatformStoreById(...args);
  }

  getPlatformStoreUsage(
    ...args: Parameters<SaasService['getPlatformStoreUsage']>
  ): ReturnType<SaasService['getPlatformStoreUsage']> {
    return this.saasService.getPlatformStoreUsage(...args);
  }

  getPlatformStoreActivity(
    ...args: Parameters<SaasService['getPlatformStoreActivity']>
  ): ReturnType<SaasService['getPlatformStoreActivity']> {
    return this.saasService.getPlatformStoreActivity(...args);
  }

  getPlatformStoreSubscription(
    ...args: Parameters<SaasService['getPlatformStoreSubscription']>
  ): ReturnType<SaasService['getPlatformStoreSubscription']> {
    return this.saasService.getPlatformStoreSubscription(...args);
  }

  getPlatformStore360(
    ...args: Parameters<SaasService['getPlatformStore360']>
  ): ReturnType<SaasService['getPlatformStore360']> {
    return this.saasService.getPlatformStore360(...args);
  }

  updateStoreSuspension(
    ...args: Parameters<SaasService['updateStoreSuspension']>
  ): ReturnType<SaasService['updateStoreSuspension']> {
    return this.saasService.updateStoreSuspension(...args);
  }

  previewStoreDeletion(
    ...args: Parameters<SaasService['previewStoreDeletion']>
  ): ReturnType<SaasService['previewStoreDeletion']> {
    return this.saasService.previewStoreDeletion(...args);
  }

  confirmStoreDeletion(
    ...args: Parameters<SaasService['confirmStoreDeletion']>
  ): ReturnType<SaasService['confirmStoreDeletion']> {
    return this.saasService.confirmStoreDeletion(...args);
  }

  getStoreDeletionStatus(
    ...args: Parameters<SaasService['getStoreDeletionStatus']>
  ): ReturnType<SaasService['getStoreDeletionStatus']> {
    return this.saasService.getStoreDeletionStatus(...args);
  }

  retryStorePurge(
    ...args: Parameters<SaasService['retryStorePurge']>
  ): ReturnType<SaasService['retryStorePurge']> {
    return this.saasService.retryStorePurge(...args);
  }
}

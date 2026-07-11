import { Injectable } from '@nestjs/common';
import { SaasService } from '../../../saas/saas.service';

@Injectable()
export class PlatformDomainsService {
  constructor(private readonly saasService: SaasService) {}

  getPlatformStoreDomains(
    ...args: Parameters<SaasService['getPlatformStoreDomains']>
  ): ReturnType<SaasService['getPlatformStoreDomains']> {
    return this.saasService.getPlatformStoreDomains(...args);
  }

  listPlatformDomains(
    ...args: Parameters<SaasService['listPlatformDomains']>
  ): ReturnType<SaasService['listPlatformDomains']> {
    return this.saasService.listPlatformDomains(...args);
  }

  listPlatformDomainIssues(
    ...args: Parameters<SaasService['listPlatformDomainIssues']>
  ): ReturnType<SaasService['listPlatformDomainIssues']> {
    return this.saasService.listPlatformDomainIssues(...args);
  }

  getPlatformDomainById(
    ...args: Parameters<SaasService['getPlatformDomainById']>
  ): ReturnType<SaasService['getPlatformDomainById']> {
    return this.saasService.getPlatformDomainById(...args);
  }

  recheckPlatformDomain(
    ...args: Parameters<SaasService['recheckPlatformDomain']>
  ): ReturnType<SaasService['recheckPlatformDomain']> {
    return this.saasService.recheckPlatformDomain(...args);
  }

  forceSyncPlatformDomain(
    ...args: Parameters<SaasService['forceSyncPlatformDomain']>
  ): ReturnType<SaasService['forceSyncPlatformDomain']> {
    return this.saasService.forceSyncPlatformDomain(...args);
  }
}

import { Injectable } from '@nestjs/common';
import { SaasService } from '../../../saas/saas.service';

@Injectable()
export class PlatformHealthService {
  constructor(private readonly saasService: SaasService) {}

  getPlatformHealthSummary(
    ...args: Parameters<SaasService['getPlatformHealthSummary']>
  ): ReturnType<SaasService['getPlatformHealthSummary']> {
    return this.saasService.getPlatformHealthSummary(...args);
  }

  getPlatformHealthQueues(
    ...args: Parameters<SaasService['getPlatformHealthQueues']>
  ): ReturnType<SaasService['getPlatformHealthQueues']> {
    return this.saasService.getPlatformHealthQueues(...args);
  }

  listPlatformIncidents(
    ...args: Parameters<SaasService['listPlatformIncidents']>
  ): ReturnType<SaasService['listPlatformIncidents']> {
    return this.saasService.listPlatformIncidents(...args);
  }

  createPlatformIncident(
    ...args: Parameters<SaasService['createPlatformIncident']>
  ): ReturnType<SaasService['createPlatformIncident']> {
    return this.saasService.createPlatformIncident(...args);
  }

  updatePlatformIncidentStatus(
    ...args: Parameters<SaasService['updatePlatformIncidentStatus']>
  ): ReturnType<SaasService['updatePlatformIncidentStatus']> {
    return this.saasService.updatePlatformIncidentStatus(...args);
  }
}

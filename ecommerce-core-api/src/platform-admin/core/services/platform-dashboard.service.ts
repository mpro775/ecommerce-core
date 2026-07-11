import { Injectable } from '@nestjs/common';
import { SaasService } from '../../../saas/saas.service';

@Injectable()
export class PlatformDashboardService {
  constructor(private readonly saasService: SaasService) {}

  getPlatformDashboardSummary(
    ...args: Parameters<SaasService['getPlatformDashboardSummary']>
  ): ReturnType<SaasService['getPlatformDashboardSummary']> {
    return this.saasService.getPlatformDashboardSummary(...args);
  }

  getPlatformDashboardAlerts(
    ...args: Parameters<SaasService['getPlatformDashboardAlerts']>
  ): ReturnType<SaasService['getPlatformDashboardAlerts']> {
    return this.saasService.getPlatformDashboardAlerts(...args);
  }

  getPlatformDashboardActivity(
    ...args: Parameters<SaasService['getPlatformDashboardActivity']>
  ): ReturnType<SaasService['getPlatformDashboardActivity']> {
    return this.saasService.getPlatformDashboardActivity(...args);
  }

  getPlatformDashboardGrowth(
    ...args: Parameters<SaasService['getPlatformDashboardGrowth']>
  ): ReturnType<SaasService['getPlatformDashboardGrowth']> {
    return this.saasService.getPlatformDashboardGrowth(...args);
  }
}

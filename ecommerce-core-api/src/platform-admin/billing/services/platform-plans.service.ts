import { Injectable } from '@nestjs/common';
import { SaasService } from '../../../saas/saas.service';

@Injectable()
export class PlatformPlansService {
  constructor(private readonly saasService: SaasService) {}

  listPlans(...args: Parameters<SaasService['listPlans']>): ReturnType<SaasService['listPlans']> {
    return this.saasService.listPlans(...args);
  }

  createPlan(
    ...args: Parameters<SaasService['createPlan']>
  ): ReturnType<SaasService['createPlan']> {
    return this.saasService.createPlan(...args);
  }

  updatePlan(
    ...args: Parameters<SaasService['updatePlan']>
  ): ReturnType<SaasService['updatePlan']> {
    return this.saasService.updatePlan(...args);
  }

  archivePlan(
    ...args: Parameters<SaasService['archivePlan']>
  ): ReturnType<SaasService['archivePlan']> {
    return this.saasService.archivePlan(...args);
  }

  duplicatePlan(
    ...args: Parameters<SaasService['duplicatePlan']>
  ): ReturnType<SaasService['duplicatePlan']> {
    return this.saasService.duplicatePlan(...args);
  }
}

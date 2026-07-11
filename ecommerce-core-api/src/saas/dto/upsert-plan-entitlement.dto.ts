import { IsBoolean, IsIn } from 'class-validator';
import { SAAS_FEATURES } from '../constants/saas-metrics.constants';

export class UpsertPlanEntitlementDto {
  @IsIn(SAAS_FEATURES)
  featureKey!: (typeof SAAS_FEATURES)[number];

  @IsBoolean()
  isEnabled!: boolean;
}

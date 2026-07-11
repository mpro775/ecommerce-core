import { IsIn, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import {
  SUBSCRIPTION_BILLING_CYCLES,
  SUBSCRIPTION_STATUSES,
  type SubscriptionBillingCycle,
  type SubscriptionStatus,
} from '../constants/subscription-core.constants';

export class AssignStorePlanDto {
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  planCode!: string;

  @IsOptional()
  @IsIn(SUBSCRIPTION_STATUSES)
  status?: SubscriptionStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  trialDays?: number;

  @IsOptional()
  @IsIn(SUBSCRIPTION_BILLING_CYCLES)
  billingCycle?: SubscriptionBillingCycle;
}

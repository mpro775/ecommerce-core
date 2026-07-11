import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  SUBSCRIPTION_ACCOUNTING_CATEGORIES,
  SUBSCRIPTION_ADJUSTMENT_OPERATIONS,
  SUBSCRIPTION_BILLING_CYCLES,
  SUBSCRIPTION_STATUSES,
  type SubscriptionAccountingCategory,
  type SubscriptionAdjustmentOperation,
  type SubscriptionBillingCycle,
  type SubscriptionStatus,
} from '../constants/subscription-core.constants';

export class AdjustSubscriptionDto {
  @IsIn(SUBSCRIPTION_ADJUSTMENT_OPERATIONS)
  operation!: SubscriptionAdjustmentOperation;

  @ValidateIf((body: AdjustSubscriptionDto) =>
    [
      'extend_period',
      'reduce_period',
      'grant_trial_days',
      'compensation',
      'marketing_gift',
    ].includes(body.operation),
  )
  @IsInt()
  @Min(1)
  days?: number;

  @ValidateIf((body: AdjustSubscriptionDto) =>
    ['set_period_end', 'mark_paid_until'].includes(body.operation),
  )
  @IsDateString()
  periodEnd?: string;

  @ValidateIf((body: AdjustSubscriptionDto) => body.operation === 'set_next_billing_at')
  @IsDateString()
  nextBillingAt?: string;

  @IsOptional()
  @ValidateIf((body: AdjustSubscriptionDto) => body.trialEndsAt !== null)
  @IsDateString()
  trialEndsAt?: string | null;

  @ValidateIf((body: AdjustSubscriptionDto) => body.operation === 'set_status')
  @IsIn(SUBSCRIPTION_STATUSES)
  status?: SubscriptionStatus;

  @ValidateIf((body: AdjustSubscriptionDto) => body.operation === 'reset_billing_cycle')
  @IsIn(SUBSCRIPTION_BILLING_CYCLES)
  billingCycle?: SubscriptionBillingCycle;

  @IsIn(SUBSCRIPTION_ACCOUNTING_CATEGORIES)
  accountingCategory!: SubscriptionAccountingCategory;

  @IsOptional()
  @IsBoolean()
  affectsRevenue?: boolean;

  @ValidateIf(
    (body: AdjustSubscriptionDto) =>
      body.affectsRevenue === true || body.accountingCategory === 'revenue',
  )
  @IsNumber()
  @Min(0)
  amount?: number;

  @ValidateIf(
    (body: AdjustSubscriptionDto) =>
      body.affectsRevenue === true || body.accountingCategory === 'revenue',
  )
  @IsString()
  @Length(3, 3)
  currencyCode?: string;

  @IsString()
  @Length(5, 255)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import type { SubscriptionAccountingCategory } from '../constants/subscription-core.constants';

export class UpsertSubscriptionCouponDto {
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9_-]{3,40}$/)
  code?: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsIn(['percent', 'fixed', 'free_days', 'free_months', 'activate_plan'])
  discountType!: 'percent' | 'fixed' | 'free_days' | 'free_months' | 'activate_plan';

  @IsNumber()
  @Min(0)
  discountValue!: number;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currencyCode?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationMonths?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  appliesToPlanCodes?: string[];

  @IsOptional()
  @IsIn(['discount', 'activation', 'retention', 'compensation', 'trial'])
  purpose?: 'discount' | 'activation' | 'retention' | 'compensation' | 'trial';

  @IsOptional()
  @IsIn([
    'revenue',
    'marketing_gift',
    'trial',
    'coupon_discount',
    'compensation',
    'manual_adjustment',
    'internal_test',
  ])
  accountingCategory?: SubscriptionAccountingCategory;

  @IsOptional()
  @IsBoolean()
  affectsRevenue?: boolean;

  @IsOptional()
  @IsString()
  activatePlanCode?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxRedemptions?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxRedemptionsPerStore?: number | null;

  @IsOptional()
  @IsDateString()
  startsAt?: string | null;

  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ValidateSubscriptionCouponDto {
  @IsString()
  code!: string;

  @IsString()
  planCode!: string;

  @IsIn(['monthly', 'annual'])
  billingCycle!: 'monthly' | 'annual';
}

import { IsDateString, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import {
  SUBSCRIPTION_ACCOUNTING_CATEGORIES,
  SUBSCRIPTION_ADJUSTMENT_OPERATIONS,
  type SubscriptionAccountingCategory,
  type SubscriptionAdjustmentOperation,
} from '../constants/subscription-core.constants';

export class ListSubscriptionAdjustmentsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 25;

  @IsOptional()
  @IsIn(SUBSCRIPTION_ADJUSTMENT_OPERATIONS)
  operation?: SubscriptionAdjustmentOperation;

  @IsOptional()
  @IsIn(SUBSCRIPTION_ACCOUNTING_CATEGORIES)
  accountingCategory?: SubscriptionAccountingCategory;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

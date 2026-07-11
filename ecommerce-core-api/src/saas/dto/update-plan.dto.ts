import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { UpsertPlanEntitlementDto } from './upsert-plan-entitlement.dto';
import { UpsertPlanLimitDto } from './upsert-plan-limit.dto';

export class UpdatePlanDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currencyCode?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyPrice?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  annualPrice?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyCompareAtPrice?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  annualCompareAtPrice?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  trialDaysDefault?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  saleLabel?: string | null;

  @IsOptional()
  @IsDateString()
  saleStartsAt?: string | null;

  @IsOptional()
  @IsDateString()
  saleEndsAt?: string | null;

  @IsOptional()
  @IsBoolean()
  isIntroOffer?: boolean;

  @IsOptional()
  @IsBoolean()
  isSaleActive?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  @IsString({ each: true })
  @Matches(/^(monthly|annual)$/, { each: true })
  billingCycleOptions?: Array<'monthly' | 'annual'>;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => UpsertPlanLimitDto)
  limits?: UpsertPlanLimitDto[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => UpsertPlanEntitlementDto)
  entitlements?: UpsertPlanEntitlementDto[];
}

import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

const TEMPLATE_STATUSES = ['draft', 'published', 'archived'] as const;
const PRODUCTION_STATUSES = [
  'production_ready',
  'beta',
  'experimental',
  'hidden',
  'deprecated',
] as const;
const TEMPLATE_CATEGORIES = [
  'general',
  'electronics',
  'beauty',
  'fashion',
  'grocery',
  'home',
  'restaurant',
  'services',
  'other',
  'luxury',
  'minimal',
] as const;

export class ListPlatformThemeTemplatesQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(TEMPLATE_STATUSES)
  status?: string;

  @IsOptional()
  @IsIn(PRODUCTION_STATUSES)
  productionStatus?: string;

  @IsOptional()
  @IsIn(TEMPLATE_CATEGORIES)
  category?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isPremium?: boolean;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

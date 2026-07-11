import {
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

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
] as const;

export class UpsertPlatformThemeTemplateDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  templateKey!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(140)
  name!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(500)
  description!: string;

  @IsString()
  @IsIn(TEMPLATE_CATEGORIES)
  category!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  componentKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  thumbnailUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  previewImageUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  previewImages?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(240)
  suitableFor?: string;

  @IsOptional()
  @IsBoolean()
  isPremium?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  requiredPlan?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedPlans?: string[];

  @IsOptional()
  @IsObject()
  assets?: Record<string, unknown>;

  @IsObject()
  settingsSchema!: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  capabilities?: Record<string, unknown>;

  @IsObject()
  config!: Record<string, unknown>;
}

import { IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateStoreSeoSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(70)
  homeSeoTitleAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(70)
  homeSeoTitleEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(170)
  homeSeoDescriptionAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(170)
  homeSeoDescriptionEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(70)
  defaultSeoTitleAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(70)
  defaultSeoTitleEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(170)
  defaultSeoDescriptionAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(170)
  defaultSeoDescriptionEn?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  defaultOgImage?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  defaultTwitterImage?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(256)
  googleSiteVerification?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  googleAnalyticsMeasurementId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  bingSiteVerification?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  facebookDomainVerification?: string;

  @IsOptional()
  @IsBoolean()
  seoIndexEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  seoFollowDefault?: boolean;

  @IsOptional()
  @IsUrl({ require_tld: false })
  canonicalBaseUrl?: string;

  @IsOptional()
  @IsIn(['ar', 'en'])
  defaultLanguage?: 'ar' | 'en';

  @IsOptional()
  @IsArray()
  @IsIn(['ar', 'en'], { each: true })
  supportedLanguages?: Array<'ar' | 'en'>;
}

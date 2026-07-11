import { IsBoolean, IsIn, IsOptional, IsUUID } from 'class-validator';

export class SeoSuggestionDto {
  @IsIn(['home', 'product', 'category', 'page'])
  targetType!: 'home' | 'product' | 'category' | 'page';

  @IsOptional()
  @IsUUID()
  targetId?: string;

  @IsIn(['ar', 'en', 'both'])
  language!: 'ar' | 'en' | 'both';
}

export class SeoAutoFixDto {
  @IsIn(['all', 'home', 'products', 'categories', 'pages'])
  scope: 'all' | 'home' | 'products' | 'categories' | 'pages' = 'all';

  @IsOptional()
  @IsUUID()
  targetId?: string;

  @IsOptional()
  @IsIn([
    'missing_title_ar',
    'missing_description_ar',
    'missing_title_en',
    'missing_description_en',
    'title_ar_too_short',
    'title_ar_too_long',
    'description_ar_too_short',
    'description_ar_too_long',
    'title_en_too_short',
    'title_en_too_long',
    'description_en_too_short',
    'description_en_too_long',
    'duplicate_title_ar',
    'duplicate_description_ar',
    'duplicate_title_en',
    'duplicate_description_en',
  ])
  issueType?: string;

  @IsIn(['ar', 'en', 'both'])
  language: 'ar' | 'en' | 'both' = 'both';

  @IsOptional()
  @IsBoolean()
  overwriteExisting?: boolean = false;

  @IsOptional()
  @IsIn(['missing_only', 'improve_weak', 'replace_all'])
  overwriteMode?: 'missing_only' | 'improve_weak' | 'replace_all' = 'missing_only';
}

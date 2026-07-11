import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { STORE_SLUG_REGEX } from '../constants/store-slug.constants';
import {
  STORE_BUSINESS_CATEGORIES,
  STORE_CURRENCY_CODES,
  STORE_SOCIAL_LINK_KEYS,
  STORE_TIMEZONES,
  STORE_WORKING_DAYS,
  YEMEN_GOVERNORATES,
} from '../constants/store-settings.constants';

class WorkingHoursSlotDto {
  @IsString()
  @Length(5, 5)
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  open!: string;

  @IsString()
  @Length(5, 5)
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  close!: string;
}

class WorkingHoursDayDto {
  @IsIn(STORE_WORKING_DAYS)
  day!: (typeof STORE_WORKING_DAYS)[number];

  @IsBoolean()
  isClosed!: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkingHoursSlotDto)
  slots?: WorkingHoursSlotDto[];
}

export class UpdateStoreSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  nameAr?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  nameEn?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  descriptionAr?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  descriptionEn?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @IsString()
  @Length(3, 50)
  @Matches(STORE_SLUG_REGEX, {
    message:
      'Slug must be 3-50 chars and contain only lowercase letters, numbers, and hyphens. It must not start or end with a hyphen.',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  @IsIn(STORE_CURRENCY_CODES)
  currencyCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @IsIn(STORE_TIMEZONES)
  timezone?: string;

  @IsOptional()
  @IsUUID('4')
  logoMediaAssetId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  logoUrl?: string | null;

  @IsOptional()
  @IsUUID('4')
  faviconMediaAssetId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  faviconUrl?: string | null;

  @IsOptional()
  @IsString()
  @IsIn(STORE_BUSINESS_CATEGORIES)
  businessCategory?: (typeof STORE_BUSINESS_CATEGORIES)[number] | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  @IsIn(YEMEN_GOVERNORATES, { message: 'اختر محافظة يمنية صحيحة' })
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  addressDetails?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-90)
  @Max(90)
  latitude?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-180)
  @Max(180)
  longitude?: number | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkingHoursDayDto)
  workingHours?: WorkingHoursDayDto[];

  @IsOptional()
  @IsObject()
  socialLinks?: Partial<Record<(typeof STORE_SOCIAL_LINK_KEYS)[number], string | null>>;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  shippingPolicy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  returnPolicy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  privacyPolicy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  termsAndConditions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  loyaltyPolicy?: string;

  @IsOptional()
  @IsBoolean()
  onboardingCompleted?: boolean;
}

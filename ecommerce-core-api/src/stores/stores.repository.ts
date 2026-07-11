import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface StoreSettingsRecord {
  id: string;
  name: string;
  name_ar: string | null;
  name_en: string | null;
  description_ar: string | null;
  description_en: string | null;
  slug: string;
  logo_media_asset_id: string | null;
  logo_url: string | null;
  favicon_media_asset_id: string | null;
  favicon_url: string | null;
  business_category: string | null;
  onboarding_completed_at: Date | null;
  phone: string | null;
  address: string | null;
  country: string;
  city: string | null;
  address_details: string | null;
  latitude: number | null;
  longitude: number | null;
  working_hours: Array<{
    day: string;
    isClosed: boolean;
    slots: Array<{ open: string; close: string }>;
  }>;
  social_links: Record<string, unknown>;
  currency_code: string;
  base_currency_code: string;
  default_currency_code: string;
  timezone: string;
  shipping_policy: string | null;
  return_policy: string | null;
  privacy_policy: string | null;
  terms_of_service: string | null;
  loyalty_policy: string | null;
}

export interface StorePublicRecord {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  favicon_url: string | null;
  currency_code: string;
  status: string;
  is_suspended: boolean;
}

@Injectable()
export class StoresRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async findById(storeId: string): Promise<StoreSettingsRecord | null> {
    const result = await this.databaseService.db.query<StoreSettingsRecord>(
      `
        SELECT id, name, name_ar, name_en, description_ar, description_en,
               slug, logo_media_asset_id, logo_url, phone, address,
               favicon_media_asset_id, favicon_url, business_category, onboarding_completed_at,
               country, city, address_details, latitude, longitude,
               working_hours, social_links,
               currency_code, base_currency_code, default_currency_code, timezone,
               shipping_policy, return_policy, privacy_policy, terms_of_service
               , loyalty_policy
        FROM stores
        WHERE id = $1
        LIMIT 1
      `,
      [storeId],
    );

    return result.rows[0] ?? null;
  }

  async findBySlug(storeSlug: string): Promise<StorePublicRecord | null> {
    const result = await this.databaseService.db.query<StorePublicRecord>(
      `
        SELECT id, name, slug, logo_url, favicon_url, currency_code,
               COALESCE(status, CASE WHEN is_suspended THEN 'suspended' ELSE 'active' END) AS status,
               is_suspended
        FROM stores
        WHERE slug = $1
          AND COALESCE(status, 'active') <> 'deleted'
        LIMIT 1
      `,
      [storeSlug],
    );

    return result.rows[0] ?? null;
  }

  async findPublicByHostname(hostname: string): Promise<StorePublicRecord | null> {
    const result = await this.databaseService.db.query<StorePublicRecord>(
      `
        SELECT s.id, s.name, s.slug, s.logo_url, s.favicon_url, s.currency_code,
               COALESCE(s.status, CASE WHEN s.is_suspended THEN 'suspended' ELSE 'active' END) AS status,
               s.is_suspended
        FROM stores s
        INNER JOIN store_domains d
          ON d.store_id = s.id
        WHERE LOWER(d.hostname) = LOWER($1)
          AND d.status = 'active'
          AND COALESCE(s.status, 'active') <> 'deleted'
        LIMIT 1
      `,
      [hostname],
    );

    return result.rows[0] ?? null;
  }

  async findPublicById(storeId: string): Promise<StorePublicRecord | null> {
    const result = await this.databaseService.db.query<StorePublicRecord>(
      `
        SELECT id, name, slug, logo_url, favicon_url, currency_code,
               COALESCE(status, CASE WHEN is_suspended THEN 'suspended' ELSE 'active' END) AS status,
               is_suspended
        FROM stores
        WHERE id = $1
          AND COALESCE(status, 'active') <> 'deleted'
        LIMIT 1
      `,
      [storeId],
    );

    return result.rows[0] ?? null;
  }

  async updateSettings(input: {
    storeId: string;
    name: string;
    nameAr: string | null;
    nameEn: string | null;
    descriptionAr: string | null;
    descriptionEn: string | null;
    slug: string;
    currencyCode: string;
    timezone: string;
    logoMediaAssetId: string | null;
    logoUrl: string | null;
    faviconMediaAssetId: string | null;
    faviconUrl: string | null;
    businessCategory: string | null;
    phone: string | null;
    address: string | null;
    country: string;
    city: string | null;
    addressDetails: string | null;
    latitude: number | null;
    longitude: number | null;
    workingHours: Array<{
      day: string;
      isClosed: boolean;
      slots: Array<{ open: string; close: string }>;
    }>;
    socialLinks: Record<string, unknown>;
    shippingPolicy: string | null;
    returnPolicy: string | null;
    privacyPolicy: string | null;
    termsOfService: string | null;
    loyaltyPolicy: string | null;
    onboardingCompletedAt: Date | null;
  }): Promise<StoreSettingsRecord> {
    const result = await this.databaseService.db.query<StoreSettingsRecord>(
      `
        UPDATE stores
        SET name = $2,
            name_ar = $3,
            name_en = $4,
            description_ar = $5,
            description_en = $6,
            slug = $7,
            currency_code = $8,
            default_currency_code = $8,
            base_currency_code = 'YER',
            timezone = $9,
            logo_media_asset_id = $10,
            logo_url = $11,
            favicon_media_asset_id = $12,
            favicon_url = $13,
            business_category = $14,
            phone = $15,
            address = $16,
            country = $17,
            city = $18,
            address_details = $19,
            latitude = $20,
            longitude = $21,
            working_hours = $22::jsonb,
            social_links = $23::jsonb,
            shipping_policy = $24,
            return_policy = $25,
            privacy_policy = $26,
            terms_of_service = $27,
            loyalty_policy = $28,
            onboarding_completed_at = $29,
            updated_at = NOW()
        WHERE id = $1
        RETURNING id, name, name_ar, name_en, description_ar, description_en,
                  slug, logo_media_asset_id, logo_url,
                  favicon_media_asset_id, favicon_url, business_category, onboarding_completed_at,
                  phone, address,
                  country, city, address_details, latitude, longitude,
                  working_hours, social_links,
                  currency_code, base_currency_code, default_currency_code, timezone,
                  shipping_policy, return_policy, privacy_policy, terms_of_service, loyalty_policy
      `,
      [
        input.storeId,
        input.name,
        input.nameAr,
        input.nameEn,
        input.descriptionAr,
        input.descriptionEn,
        input.slug,
        input.currencyCode,
        input.timezone,
        input.logoMediaAssetId,
        input.logoUrl,
        input.faviconMediaAssetId,
        input.faviconUrl,
        input.businessCategory,
        input.phone,
        input.address,
        input.country,
        input.city,
        input.addressDetails,
        input.latitude,
        input.longitude,
        JSON.stringify(input.workingHours),
        JSON.stringify(input.socialLinks),
        input.shippingPolicy,
        input.returnPolicy,
        input.privacyPolicy,
        input.termsOfService,
        input.loyaltyPolicy,
        input.onboardingCompletedAt,
      ],
    );

    return result.rows[0] as StoreSettingsRecord;
  }

  async findStoreBySlug(storeSlug: string): Promise<{ id: string; slug: string } | null> {
    const result = await this.databaseService.db.query<{ id: string; slug: string }>(
      `
        SELECT id, slug
        FROM stores
        WHERE slug = $1
        LIMIT 1
      `,
      [storeSlug],
    );

    return result.rows[0] ?? null;
  }
}

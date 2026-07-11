import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import type { RequestContextData } from '../common/utils/request-context.util';
import { parseIanaTimezone } from '../common/utils/timezone.util';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { MediaService, type AltTextCoverageResponse } from '../media/media.service';
import { CurrencyService, type StoreCurrencyResponse } from '../currency/currency.service';
import {
  DEFAULT_STORE_COUNTRY,
  STORE_BUSINESS_CATEGORIES,
  STORE_CURRENCY_CODES,
  STORE_SOCIAL_LINK_KEYS,
  STORE_TIMEZONES,
  STORE_WORKING_DAYS,
  YEMEN_GOVERNORATES,
} from './constants/store-settings.constants';
import {
  isReservedStoreSubdomain,
  isValidStoreSlug,
  normalizeStoreSlug,
} from './constants/store-slug.constants';
import type { UpdateStoreSettingsDto } from './dto/update-store-settings.dto';
import { StoresRepository, type StoreSettingsRecord } from './stores.repository';

interface WorkingHoursSlot {
  open: string;
  close: string;
}

interface WorkingHoursDay {
  day: (typeof STORE_WORKING_DAYS)[number];
  isClosed: boolean;
  slots: WorkingHoursSlot[];
}

type SocialLinks = Partial<Record<(typeof STORE_SOCIAL_LINK_KEYS)[number], string | null>>;

export interface StoreSettingsResponse {
  id: string;
  name: string;
  nameAr: string | null;
  nameEn: string | null;
  descriptionAr: string | null;
  descriptionEn: string | null;
  description: string | null;
  slug: string;
  logoMediaAssetId: string | null;
  logoUrl: string | null;
  faviconMediaAssetId: string | null;
  faviconUrl: string | null;
  businessCategory: string | null;
  onboardingCompleted: boolean;
  phone: string | null;
  address: string | null;
  country: string;
  city: string | null;
  addressDetails: string | null;
  latitude: number | null;
  longitude: number | null;
  workingHours: WorkingHoursDay[];
  socialLinks: SocialLinks;
  currencyCode: string;
  baseCurrencyCode: string;
  defaultCurrencyCode: string;
  currencies: StoreCurrencyResponse[];
  timezone: string;
  shippingPolicy: string | null;
  returnPolicy: string | null;
  privacyPolicy: string | null;
  termsAndConditions: string | null;
  loyaltyPolicy: string | null;
}

export interface StoreSettingsOptionsResponse {
  defaultCountry: string;
  currencies: readonly string[];
  timezones: readonly string[];
  governorates: readonly string[];
  workingDays: readonly string[];
  socialPlatforms: readonly string[];
  businessCategories: readonly string[];
}

export interface StoreSlugAvailabilityResponse {
  isValidFormat: boolean;
  isAvailable: boolean;
  normalizedSlug: string;
  reason?: 'reserved' | 'invalid_format' | 'taken';
}

export interface StoreAccessibilityReportResponse {
  storeId: string;
  themeAuditSummary: {
    score: number;
    wcagLevel: 'AA';
    criticalIssues: number;
    seriousIssues: number;
    warningIssues: number;
    auditedAt: string;
  };
  altTextCoverage: AltTextCoverageResponse;
  criticalIssues: Array<Record<string, never>>;
  seriousIssues: Array<Record<string, never>>;
  recommendations: string[];
}

@Injectable()
export class StoresService {
  constructor(
    private readonly storesRepository: StoresRepository,
    private readonly auditService: AuditService,
    private readonly mediaService: MediaService,
    private readonly currencyService: CurrencyService,
  ) {}

  async getSettings(currentUser: AuthUser): Promise<StoreSettingsResponse> {
    const store = await this.storesRepository.findById(currentUser.storeId);
    if (!store) {
      throw new NotFoundException('Store not found');
    }
    const currencies = await this.currencyService.listStoreCurrencies(currentUser.storeId);
    return this.toResponse(store, currencies);
  }

  getSettingsOptions(): StoreSettingsOptionsResponse {
    return {
      defaultCountry: DEFAULT_STORE_COUNTRY,
      currencies: STORE_CURRENCY_CODES,
      timezones: STORE_TIMEZONES,
      governorates: YEMEN_GOVERNORATES,
      workingDays: STORE_WORKING_DAYS,
      socialPlatforms: STORE_SOCIAL_LINK_KEYS,
      businessCategories: STORE_BUSINESS_CATEGORIES,
    };
  }

  async checkSlugAvailability(
    currentUser: AuthUser,
    rawSlug: string,
  ): Promise<StoreSlugAvailabilityResponse> {
    const normalizedSlug = normalizeStoreSlug(rawSlug);
    if (isReservedStoreSubdomain(normalizedSlug)) {
      return {
        isValidFormat: true,
        isAvailable: false,
        normalizedSlug,
        reason: 'reserved',
      };
    }

    const isValidFormat = isValidStoreSlug(normalizedSlug);
    if (!isValidFormat) {
      return {
        isValidFormat: false,
        isAvailable: false,
        normalizedSlug,
        reason: 'invalid_format',
      };
    }

    const existingStore = await this.storesRepository.findStoreBySlug(normalizedSlug);
    const isAvailable = !existingStore || existingStore.id === currentUser.storeId;

    return {
      isValidFormat: true,
      isAvailable,
      normalizedSlug,
      ...(isAvailable ? {} : { reason: 'taken' as const }),
    };
  }

  async updateSettings(
    currentUser: AuthUser,
    input: UpdateStoreSettingsDto,
    context: RequestContextData,
  ): Promise<StoreSettingsResponse> {
    const current = await this.storesRepository.findById(currentUser.storeId);
    if (!current) {
      throw new NotFoundException('Store not found');
    }

    const payload = await this.buildUpdatePayload(current, input);
    const updated = await this.storesRepository.updateSettings(payload);
    await this.logSettingsUpdate(currentUser, context);

    return this.toResponse(updated);
  }

  async getCurrencies(currentUser: AuthUser): Promise<{
    baseCurrencyCode: 'YER';
    defaultCurrencyCode: string;
    currencies: StoreCurrencyResponse[];
  }> {
    const currencies = await this.currencyService.listStoreCurrencies(currentUser.storeId);
    const defaultCurrency = currencies.find((currency) => currency.isDefault) ?? currencies[0];
    return {
      baseCurrencyCode: 'YER',
      defaultCurrencyCode: defaultCurrency?.currencyCode ?? 'YER',
      currencies,
    };
  }

  async updateCurrencies(
    currentUser: AuthUser,
    currencies: StoreCurrencyResponse[],
    context: RequestContextData,
  ): Promise<{
    baseCurrencyCode: 'YER';
    defaultCurrencyCode: string;
    currencies: StoreCurrencyResponse[];
  }> {
    const updated = await this.currencyService.replaceStoreCurrencies(
      currentUser.storeId,
      currencies,
    );
    await this.auditService.log({
      action: 'store.currencies_updated',
      storeId: currentUser.storeId,
      storeUserId: currentUser.id,
      targetType: 'store',
      targetId: currentUser.storeId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: context.requestId ? { requestId: context.requestId } : {},
    });
    const defaultCurrency = updated.find((currency) => currency.isDefault) ?? updated[0];
    return {
      baseCurrencyCode: 'YER',
      defaultCurrencyCode: defaultCurrency?.currencyCode ?? 'YER',
      currencies: updated,
    };
  }

  async getAltTextCoverage(
    currentUser: AuthUser,
    storeId: string,
  ): Promise<AltTextCoverageResponse> {
    this.assertCurrentStore(currentUser, storeId);
    return this.mediaService.getAltTextCoverageByStoreId(storeId);
  }

  async getAccessibilityReport(
    currentUser: AuthUser,
    storeId: string,
    context: RequestContextData,
  ): Promise<StoreAccessibilityReportResponse> {
    this.assertCurrentStore(currentUser, storeId);
    const altTextCoverage = await this.mediaService.getAltTextCoverageByStoreId(storeId);
    const criticalIssues: Array<Record<string, never>> = [];
    const seriousIssues: Array<Record<string, never>> = [];
    const recommendations = [
      ...(altTextCoverage.missingAltImages > 0
        ? ['Add localized alt text or mark decorative images explicitly.']
        : []),
    ];

    await this.auditService.log({
      action: 'store.accessibility_report_generated',
      storeId,
      storeUserId: currentUser.id,
      targetType: 'store',
      targetId: storeId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        score: altTextCoverage.completionRate,
        criticalIssues: 0,
        seriousIssues: 0,
        missingAltImages: altTextCoverage.missingAltImages,
        ...(context.requestId ? { requestId: context.requestId } : {}),
      },
    });

    return {
      storeId,
      themeAuditSummary: {
        score: altTextCoverage.completionRate,
        wcagLevel: 'AA',
        criticalIssues: 0,
        seriousIssues: 0,
        warningIssues: 0,
        auditedAt: new Date().toISOString(),
      },
      altTextCoverage,
      criticalIssues,
      seriousIssues,
      recommendations,
    };
  }

  private assertCurrentStore(currentUser: AuthUser, storeId: string): void {
    if (currentUser.storeId !== storeId) {
      throw new ForbiddenException(
        'You can only access accessibility reports for your current store.',
      );
    }
  }

  private async buildUpdatePayload(current: StoreSettingsRecord, input: UpdateStoreSettingsDto) {
    const hasTimezone = this.hasOwn(input, 'timezone');
    const hasCurrencyCode = this.hasOwn(input, 'currencyCode');
    const hasSlug = this.hasOwn(input, 'slug');
    const hasCountry = this.hasOwn(input, 'country');
    const hasCity = this.hasOwn(input, 'city');
    const hasAddressDetails = this.hasOwn(input, 'addressDetails');
    const hasAddress = this.hasOwn(input, 'address');
    const hasLogoMediaAssetId = this.hasOwn(input, 'logoMediaAssetId');
    const hasLogoUrl = this.hasOwn(input, 'logoUrl');
    const hasFaviconMediaAssetId = this.hasOwn(input, 'faviconMediaAssetId');
    const hasFaviconUrl = this.hasOwn(input, 'faviconUrl');
    const hasBusinessCategory = this.hasOwn(input, 'businessCategory');
    const hasOnboardingCompleted = this.hasOwn(input, 'onboardingCompleted');
    const hasPhone = this.hasOwn(input, 'phone');
    const hasShippingPolicy = this.hasOwn(input, 'shippingPolicy');
    const hasReturnPolicy = this.hasOwn(input, 'returnPolicy');
    const hasPrivacyPolicy = this.hasOwn(input, 'privacyPolicy');
    const hasTerms = this.hasOwn(input, 'termsAndConditions');
    const hasLoyaltyPolicy = this.hasOwn(input, 'loyaltyPolicy');
    const hasLatitude = this.hasOwn(input, 'latitude');
    const hasLongitude = this.hasOwn(input, 'longitude');
    const hasNameAr = this.hasOwn(input, 'nameAr');
    const hasNameEn = this.hasOwn(input, 'nameEn');
    const hasDescriptionAr = this.hasOwn(input, 'descriptionAr');
    const hasDescriptionEn = this.hasOwn(input, 'descriptionEn');
    const hasDescription = this.hasOwn(input, 'description');

    const resolvedTimezone =
      hasTimezone && typeof input.timezone === 'string'
        ? parseIanaTimezone(input.timezone)
        : current.timezone;

    if (!resolvedTimezone) {
      throw new BadRequestException('Invalid timezone. Please use a valid IANA timezone value.');
    }

    const country = hasCountry
      ? this.normalizeCountry(input.country)
      : (current.country ?? DEFAULT_STORE_COUNTRY);
    const city = hasCity ? this.normalizeOptionalText(input.city, 80) : current.city;
    const addressDetails = hasAddressDetails
      ? this.normalizeOptionalText(input.addressDetails, 500)
      : current.address_details;

    const latitude = hasLatitude ? (input.latitude ?? null) : current.latitude;
    const longitude = hasLongitude ? (input.longitude ?? null) : current.longitude;
    if ((latitude === null) !== (longitude === null)) {
      throw new BadRequestException('Latitude and longitude must be provided together.');
    }

    const workingHours = this.resolveWorkingHours(current.working_hours, input.workingHours);
    const socialLinks = this.resolveSocialLinks(current.social_links, input.socialLinks);
    const resolvedAddress = hasAddress
      ? this.normalizeOptionalText(input.address, 250)
      : (this.composeAddress(country, city, addressDetails) ?? current.address);

    let resolvedSlug = current.slug;
    if (hasSlug) {
      const candidateSlug = this.normalizeOptionalText(input.slug, 50);
      const normalizedCandidateSlug = candidateSlug ? normalizeStoreSlug(candidateSlug) : null;
      if (normalizedCandidateSlug && !isValidStoreSlug(normalizedCandidateSlug)) {
        throw new BadRequestException('Store slug format is invalid.');
      }

      if (normalizedCandidateSlug) {
        const existingStore = await this.storesRepository.findStoreBySlug(normalizedCandidateSlug);
        if (existingStore && existingStore.id !== current.id) {
          throw new BadRequestException('Store slug already in use.');
        }
        resolvedSlug = normalizedCandidateSlug;
      }
    }

    const resolvedName = this.hasOwn(input, 'name')
      ? (this.normalizeOptionalText(input.name, 120) ?? current.name)
      : current.name;

    const resolvedNameAr = hasNameAr
      ? this.normalizeOptionalText(input.nameAr, 120)
      : current.name_ar;
    const resolvedNameEn = hasNameEn
      ? this.normalizeOptionalText(input.nameEn, 120)
      : current.name_en;

    const resolvedDescriptionAr = hasDescriptionAr
      ? this.normalizeOptionalText(input.descriptionAr, 1000)
      : hasDescription
        ? (this.normalizeOptionalText(input.description, 1000) ?? current.description_ar)
        : current.description_ar;
    const resolvedDescriptionEn = hasDescriptionEn
      ? this.normalizeOptionalText(input.descriptionEn, 1000)
      : current.description_en;

    return {
      storeId: current.id,
      name: resolvedName,
      nameAr: resolvedNameAr ?? resolvedName,
      nameEn: resolvedNameEn,
      descriptionAr: resolvedDescriptionAr,
      descriptionEn: resolvedDescriptionEn,
      slug: resolvedSlug,
      currencyCode:
        hasCurrencyCode && typeof input.currencyCode === 'string'
          ? input.currencyCode
          : current.currency_code,
      timezone: resolvedTimezone,
      logoMediaAssetId: hasLogoMediaAssetId
        ? (input.logoMediaAssetId ?? null)
        : current.logo_media_asset_id,
      logoUrl: hasLogoUrl ? this.normalizeOptionalText(input.logoUrl, 400) : current.logo_url,
      faviconMediaAssetId: hasFaviconMediaAssetId
        ? (input.faviconMediaAssetId ?? null)
        : current.favicon_media_asset_id,
      faviconUrl: hasFaviconUrl
        ? this.normalizeOptionalText(input.faviconUrl, 400)
        : current.favicon_url,
      businessCategory: hasBusinessCategory
        ? (input.businessCategory ?? null)
        : current.business_category,
      phone: hasPhone ? this.normalizeOptionalText(input.phone, 30) : current.phone,
      address: resolvedAddress,
      country,
      city,
      addressDetails,
      latitude,
      longitude,
      workingHours,
      socialLinks,
      shippingPolicy: hasShippingPolicy
        ? this.normalizeOptionalText(input.shippingPolicy, 20000)
        : current.shipping_policy,
      returnPolicy: hasReturnPolicy
        ? this.normalizeOptionalText(input.returnPolicy, 20000)
        : current.return_policy,
      privacyPolicy: hasPrivacyPolicy
        ? this.normalizeOptionalText(input.privacyPolicy, 20000)
        : current.privacy_policy,
      termsOfService: hasTerms
        ? this.normalizeOptionalText(input.termsAndConditions, 20000)
        : current.terms_of_service,
      loyaltyPolicy: hasLoyaltyPolicy
        ? this.normalizeOptionalText(input.loyaltyPolicy, 20000)
        : current.loyalty_policy,
      onboardingCompletedAt: hasOnboardingCompleted
        ? input.onboardingCompleted
          ? new Date()
          : null
        : current.onboarding_completed_at,
    };
  }

  private async logSettingsUpdate(
    currentUser: AuthUser,
    context: RequestContextData,
  ): Promise<void> {
    await this.auditService.log({
      action: 'store.settings_updated',
      storeId: currentUser.storeId,
      storeUserId: currentUser.id,
      targetType: 'store',
      targetId: currentUser.storeId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: context.requestId ? { requestId: context.requestId } : {},
    });
  }

  private toResponse(
    store: StoreSettingsRecord,
    currencies: StoreCurrencyResponse[] = [],
  ): StoreSettingsResponse {
    const defaultCurrency = currencies.find((currency) => currency.isDefault);
    return {
      id: store.id,
      name: store.name,
      nameAr: store.name_ar ?? store.name,
      nameEn: store.name_en,
      descriptionAr: store.description_ar,
      descriptionEn: store.description_en,
      description: store.description_ar ?? store.description_en ?? null,
      slug: store.slug,
      logoMediaAssetId: store.logo_media_asset_id,
      logoUrl: store.logo_url,
      faviconMediaAssetId: store.favicon_media_asset_id,
      faviconUrl: store.favicon_url,
      businessCategory: store.business_category,
      onboardingCompleted: Boolean(store.onboarding_completed_at),
      phone: store.phone,
      address: store.address,
      country: this.normalizeCountry(store.country),
      city: store.city,
      addressDetails: store.address_details,
      latitude: store.latitude,
      longitude: store.longitude,
      workingHours: this.resolveWorkingHours(store.working_hours, undefined),
      socialLinks: this.resolveSocialLinks(store.social_links, undefined),
      currencyCode:
        defaultCurrency?.currencyCode ?? store.default_currency_code ?? store.currency_code,
      baseCurrencyCode: 'YER',
      defaultCurrencyCode: defaultCurrency?.currencyCode ?? store.default_currency_code ?? 'YER',
      currencies,
      timezone: store.timezone,
      shippingPolicy: store.shipping_policy,
      returnPolicy: store.return_policy,
      privacyPolicy: store.privacy_policy,
      termsAndConditions: store.terms_of_service,
      loyaltyPolicy: store.loyalty_policy,
    };
  }

  private hasOwn(input: UpdateStoreSettingsDto, key: keyof UpdateStoreSettingsDto): boolean {
    return Object.prototype.hasOwnProperty.call(input, key);
  }

  private normalizeOptionalText(
    value: string | null | undefined,
    maxLength: number,
  ): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    const normalized = value.trim().slice(0, maxLength);
    return normalized.length > 0 ? normalized : null;
  }

  private composeAddress(
    country: string | null,
    city: string | null,
    details: string | null,
  ): string | null {
    const parts = [country, city, details].map((part) => part?.trim()).filter(Boolean);
    if (parts.length === 0) {
      return null;
    }
    return parts.join('، ');
  }

  private normalizeCountry(value: string | null | undefined): string {
    const normalized = this.normalizeOptionalText(value, 80);
    if (!normalized) {
      return DEFAULT_STORE_COUNTRY;
    }

    const lower = normalized.toLowerCase();
    if (this.isDamagedText(normalized)) {
      return DEFAULT_STORE_COUNTRY;
    }

    if (lower === 'ye' || lower === 'yemen' || normalized === DEFAULT_STORE_COUNTRY) {
      return DEFAULT_STORE_COUNTRY;
    }

    throw new BadRequestException('الدولة يجب أن تكون اليمن');
  }

  private isDamagedText(value: string): boolean {
    return /[\uFFFDØÙ]/.test(value);
  }

  private resolveWorkingHours(
    current:
      | Array<{ day: string; isClosed: boolean; slots?: Array<{ open: string; close: string }> }>
      | null
      | undefined,
    incoming:
      | Array<{ day: string; isClosed: boolean; slots?: Array<{ open: string; close: string }> }>
      | undefined,
  ): WorkingHoursDay[] {
    const source = incoming ?? (Array.isArray(current) ? current : []);
    const normalized: WorkingHoursDay[] = [];
    const seenDays = new Set<string>();

    for (const row of source) {
      const day = typeof row.day === 'string' ? row.day : '';
      if (!STORE_WORKING_DAYS.includes(day as (typeof STORE_WORKING_DAYS)[number])) {
        continue;
      }
      if (seenDays.has(day)) {
        throw new BadRequestException('Working hours contains duplicated day values.');
      }
      seenDays.add(day);

      const isClosed = Boolean(row.isClosed);
      const rawSlots = Array.isArray(row.slots) ? row.slots : [];
      const slots: WorkingHoursSlot[] = [];

      for (const slot of rawSlots) {
        const open = typeof slot.open === 'string' ? slot.open.trim() : '';
        const close = typeof slot.close === 'string' ? slot.close.trim() : '';
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(open) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(close)) {
          continue;
        }
        if (open >= close) {
          throw new BadRequestException('Working hour slot open time must be before close time.');
        }
        slots.push({ open, close });
      }

      normalized.push({
        day: day as (typeof STORE_WORKING_DAYS)[number],
        isClosed,
        slots,
      });
    }

    return normalized;
  }

  private resolveSocialLinks(
    current: Record<string, unknown> | null | undefined,
    incoming: Record<string, unknown> | undefined,
  ): SocialLinks {
    const base: SocialLinks = {};

    for (const key of STORE_SOCIAL_LINK_KEYS) {
      const fallback = key === 'x' ? (current?.['x'] ?? current?.['twitter']) : current?.[key];
      const nextValue =
        incoming && Object.prototype.hasOwnProperty.call(incoming, key) ? incoming[key] : fallback;
      if (typeof nextValue !== 'string') {
        if (nextValue === null || nextValue === undefined) {
          base[key] = null;
        }
        continue;
      }

      const normalized = nextValue.trim();
      if (normalized.length === 0) {
        base[key] = null;
        continue;
      }

      this.assertValidSocialLink(key, normalized);
      base[key] = normalized;
    }

    return base;
  }

  private assertValidSocialLink(key: string, value: string): void {
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new BadRequestException(`Invalid social link URL for "${key}".`);
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new BadRequestException(`Invalid social link URL for "${key}".`);
    }
  }
}

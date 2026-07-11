import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { MediaRepository } from '../../media/media.repository';
import { STORAGE_ADAPTER, type StorageAdapter } from '../../media/storage.adapter';
import type { ListPlatformThemeTemplatesQueryDto } from './dto/list-platform-theme-templates-query.dto';
import type { DuplicatePlatformThemeTemplateDto } from './dto/duplicate-platform-theme-template.dto';
import type { PublishPlatformThemeTemplateDto } from './dto/publish-platform-theme-template.dto';
import type { PlatformAdminUser } from '../../platform/interfaces/platform-admin-user.interface';
import { validateThemeSettingsSchema } from '../../themes/theme-config.validator';
import {
  normalizeThemeConfig,
  setHomeSectionsInConfig,
} from '../../themes/utils/theme-config-normalizer';
import type { UpsertPlatformThemeTemplateDto } from './dto/upsert-platform-theme-template.dto';
import type { UpdateTemplateJsonSectionDto } from './dto/update-template-json-section.dto';
import type { UpdateTemplateMediaDto } from './dto/update-template-media.dto';
import {
  PlatformThemeTemplatesRepository,
  type PlatformThemeTemplateChangelogRecord,
  type PlatformThemeTemplateRecord,
  type PlatformThemeTemplateVersionRecord,
  type UpsertPlatformThemeTemplateInput,
} from './platform-theme-templates.repository';

export interface PlatformThemeTemplateResponse {
  id: string;
  templateKey: string;
  name: string;
  description: string;
  category: string;
  rendererType: 'component';
  componentKey: string;
  thumbnailUrl: string | null;
  previewImageUrl: string | null;
  previewImages: string[];
  tags: string[];
  suitableFor: string;
  isPremium: boolean;
  requiredPlan: string | null;
  allowedPlans: string[];
  assets: Record<string, unknown>;
  settingsSchema: Record<string, unknown>;
  defaultConfig: Record<string, unknown>;
  capabilities: Record<string, unknown>;
  accessibilityAudit: ThemeAccessibilityAudit;
  productionReadiness: TemplateProductionReadiness;
  status: string;
  productionStatus: TemplateProductionStatus;
  qualityScore: number;
  version: number;
  hasUnpublishedChanges: boolean;
  draftConfig: Record<string, unknown>;
  publishedConfig: Record<string, unknown>;
  changelog: PlatformThemeTemplateChangelogRecord[];
  lastValidatedAt: Date | null;
  lastProductionCheckAt: Date | null;
  publishedAt: Date | null;
  lastPublishedAt: Date | null;
  publishedBy: string | null;
  archivedAt: Date | null;
  updatedAt: Date;
}

export interface PlatformThemeTemplateListResponse {
  items: PlatformThemeTemplateResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}

export interface ThemeAccessibilityAudit {
  score: number;
  criticalIssues: string[];
  warnings: string[];
  checks: {
    contrastRatio: boolean;
    focusStyle: boolean;
    fontSize: boolean;
    targetSize: boolean;
    reducedMotion: boolean;
    altTextCoverage: boolean;
    underlineLinks: boolean;
    colorOnlyIndicators: boolean;
  };
}

export interface PlatformThemeTemplateValidationResponse {
  valid: boolean;
  errors: Array<{ path: string; message: string }>;
}

export type TemplateProductionStatus =
  | 'production_ready'
  | 'beta'
  | 'experimental'
  | 'hidden'
  | 'deprecated';

export interface TemplateProductionReadiness {
  status: TemplateProductionStatus;
  qualityScore: number;
  passed: boolean;
  checks: Array<{ key: string; label: string; passed: boolean; weight: number; message?: string }>;
  warnings: string[];
  blockingIssues: string[];
  reviewedAt: string | null;
  reviewedBy: string | null;
}

export interface PlatformThemeTemplateVersionResponse {
  id: string;
  templateId: string;
  templateKey: string | null;
  version: number;
  snapshot: Record<string, unknown>;
  settingsSchema: Record<string, unknown>;
  assets: Record<string, unknown>;
  capabilities: Record<string, unknown>;
  changelogTitle: string | null;
  changelogDescription: string | null;
  publishedBy: string | null;
  createdAt: Date;
}

export interface PlatformThemeTemplatePreviewResponse {
  previewUrl: string;
  expiresAt: string;
}

const VALID_PRODUCTION_STATUSES = new Set<TemplateProductionStatus>([
  'production_ready',
  'beta',
  'experimental',
  'hidden',
  'deprecated',
]);

const VALID_TEMPLATE_CATEGORIES = new Set([
  'general',
  'electronics',
  'beauty',
  'fashion',
  'grocery',
  'home',
  'restaurant',
  'services',
  'other',
]);

const KNOWN_COMPONENT_KEYS = [
  'general-starter',
  'electronics-pro',
  'beauty-luxe',
  'fashion-editorial',
  'market-modern',
];
const TEMPLATE_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PLATFORM_MEDIA_NAMESPACE = '__platform__';
const TEMPLATE_MEDIA_TYPES = new Set([
  'thumbnail',
  'preview',
  'mobilePreview',
  'desktopPreview',
  'cover',
]);
const TEMPLATE_MEDIA_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const REQUIRED_SUPPORTED_PAGES = [
  ['home', 'Home page completed'],
  ['categories', 'Categories page completed'],
  ['category', 'Category products page completed'],
  ['search', 'Search page completed'],
  ['product', 'Product page completed'],
  ['cart', 'Cart page completed'],
  ['checkout', 'Checkout page completed'],
  ['orderTracking', 'Order tracking page completed'],
  ['staticPage', 'Static pages completed'],
  ['contact', 'Contact page completed'],
  ['notFound', '404 page completed'],
] as const;

@Injectable()
export class PlatformThemeTemplatesService {
  constructor(
    private readonly repository: PlatformThemeTemplatesRepository,
    private readonly mediaRepository: MediaRepository,
    @Inject(STORAGE_ADAPTER) private readonly storageAdapter: StorageAdapter,
  ) {}

  async list(
    query: ListPlatformThemeTemplatesQueryDto,
  ): Promise<PlatformThemeTemplateListResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const result = await this.repository.list({
      search: query.search?.trim() || undefined,
      status: query.status,
      productionStatus: query.productionStatus,
      category: query.category,
      isPremium: query.isPremium,
      page,
      limit,
    });
    return {
      items: result.items.map((template) => this.toResponse(template)),
      meta: { page, limit, total: result.total },
    };
  }

  async listComponentKeys(): Promise<{ items: string[] }> {
    const stored = await this.repository.listComponentKeys();
    return { items: Array.from(new Set([...KNOWN_COMPONENT_KEYS, ...stored])).sort() };
  }

  async productionReadiness(
    id: string,
    currentUser: PlatformAdminUser | null = null,
  ): Promise<TemplateProductionReadiness> {
    const template = await this.findOrThrow(id);
    const readiness = this.evaluateProductionReadiness(template);
    await this.repository.markProductionChecked(id, currentUser?.id ?? null);
    return readiness;
  }

  async get(id: string): Promise<PlatformThemeTemplateResponse> {
    const template = await this.findOrThrow(id);
    return this.toResponse(template);
  }

  async create(input: UpsertPlatformThemeTemplateDto): Promise<PlatformThemeTemplateResponse> {
    const template = await this.repository.create(this.normalizeInput(input));
    return this.toResponse(template);
  }

  async update(
    id: string,
    input: UpsertPlatformThemeTemplateDto,
  ): Promise<PlatformThemeTemplateResponse> {
    await this.findOrThrow(id);
    const template = await this.repository.update(id, this.normalizeInput(input));
    return this.toResponse(template);
  }

  async publish(
    id: string,
    currentUser: PlatformAdminUser,
    input: PublishPlatformThemeTemplateDto = {},
  ): Promise<PlatformThemeTemplateResponse> {
    const existing = await this.findOrThrow(id);
    normalizeThemeConfig(existing.draft_config);
    if (!input.changelogTitle?.trim()) {
      throw new BadRequestException('Publish changelog title is required');
    }
    if (!KNOWN_COMPONENT_KEYS.includes(existing.component_key)) {
      throw new BadRequestException(
        'Template componentKey is not registered in the storefront registry',
      );
    }
    const validation = this.validateRecord(existing);
    if (validation.length > 0) {
      throw new BadRequestException(
        `Template validation failed: ${validation.map((item) => `${item.path}: ${item.message}`).join('; ')}`,
      );
    }
    const audit = this.auditAccessibility(existing.draft_config, existing.capabilities);
    if (audit.criticalIssues.length > 0) {
      throw new BadRequestException(
        `Theme accessibility audit failed: ${audit.criticalIssues.join('; ')}`,
      );
    }
    const readiness = this.evaluateProductionReadiness(existing);
    if (readiness.status === 'production_ready' && !readiness.passed) {
      throw new BadRequestException(
        `Theme production readiness failed: ${readiness.blockingIssues.join('; ')}`,
      );
    }
    const template = await this.repository.publish(
      id,
      currentUser.id,
      existing.version + 1,
      input.changelogTitle.trim(),
      input.changelogDescription?.trim() || null,
    );
    return this.toResponse(template);
  }

  async archive(
    id: string,
    currentUser: PlatformAdminUser | null = null,
  ): Promise<PlatformThemeTemplateResponse> {
    await this.findOrThrow(id);
    const template = await this.repository.archive(id, currentUser?.id ?? null);
    return this.toResponse(template);
  }

  async restore(
    id: string,
    currentUser: PlatformAdminUser | null = null,
  ): Promise<PlatformThemeTemplateResponse> {
    await this.findOrThrow(id);
    const template = await this.repository.restore(id, currentUser?.id ?? null);
    return this.toResponse(template);
  }

  async duplicate(
    id: string,
    currentUser: PlatformAdminUser | null = null,
    input: DuplicatePlatformThemeTemplateDto = {},
  ): Promise<PlatformThemeTemplateResponse> {
    await this.findOrThrow(id);
    const templateKey = input.templateKey?.trim().toLowerCase();
    if (templateKey) {
      if (!TEMPLATE_KEY_PATTERN.test(templateKey)) {
        throw new BadRequestException('Template key is invalid');
      }
      if (await this.repository.templateKeyExists(templateKey)) {
        throw new BadRequestException('Template key already exists');
      }
    }
    const template = await this.repository.duplicate(id, currentUser?.id ?? null, {
      templateKey,
      name: input.nameEn?.trim() || input.nameAr?.trim() || undefined,
    });
    return this.toResponse(template);
  }

  async createPreview(id: string): Promise<PlatformThemeTemplatePreviewResponse> {
    const template = await this.findOrThrow(id);
    if (!template.component_key.trim()) {
      throw new BadRequestException('Template componentKey is required for preview');
    }
    if (!KNOWN_COMPONENT_KEYS.includes(template.component_key)) {
      throw new BadRequestException(
        'Template componentKey is not registered in the storefront registry',
      );
    }

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.getPreviewTokenTtlMinutes() * 60_000);
    await this.repository.createPreviewToken({
      token,
      templateId: template.id,
      templateKey: template.template_key,
      configSnapshot: normalizeThemeConfig(template.draft_config),
      settingsSchemaSnapshot: template.settings_schema,
      assetsSnapshot: template.assets,
      capabilitiesSnapshot: template.capabilities,
      expiresAt,
    });

    return {
      previewUrl: this.buildPreviewUrl(template.template_key, token),
      expiresAt: expiresAt.toISOString(),
    };
  }

  async validateExisting(
    id: string,
    currentUser: PlatformAdminUser | null = null,
  ): Promise<PlatformThemeTemplateValidationResponse> {
    const template = await this.findOrThrow(id);
    const errors = this.validateRecord(template);
    if (errors.length === 0) {
      await this.repository.markValidated(id, currentUser?.id ?? null);
    }
    return { valid: errors.length === 0, errors };
  }

  async versions(id: string): Promise<{ items: PlatformThemeTemplateVersionResponse[] }> {
    await this.findOrThrow(id);
    const versions = await this.repository.listVersions(id);
    return { items: versions.map((version) => this.toVersionResponse(version)) };
  }

  async restoreVersion(
    id: string,
    version: number,
    currentUser: PlatformAdminUser | null = null,
  ): Promise<PlatformThemeTemplateResponse> {
    await this.findOrThrow(id);
    const snapshot = await this.repository.findVersion(id, version);
    if (!snapshot) {
      throw new NotFoundException('Theme template version not found');
    }
    const restored = await this.repository.restoreVersionDraft(
      id,
      snapshot,
      currentUser?.id ?? null,
    );
    return this.toResponse(restored);
  }

  async updateMedia(
    id: string,
    input: UpdateTemplateMediaDto,
  ): Promise<PlatformThemeTemplateResponse> {
    const template = await this.findOrThrow(id);
    return this.update(id, {
      ...this.toUpsertDto(template),
      thumbnailUrl: input.thumbnailUrl ?? template.thumbnail_url ?? undefined,
      previewImageUrl: input.previewImageUrl ?? template.preview_image_url ?? undefined,
      previewImages: input.previewImages ?? template.preview_images,
    });
  }

  async uploadMedia(
    id: string,
    file: { buffer: Buffer; mimetype: string; originalname: string; size: number } | undefined,
    type: string,
  ): Promise<PlatformThemeTemplateResponse> {
    const template = await this.findOrThrow(id);
    const mediaType = type?.trim();
    if (!file?.buffer) {
      throw new BadRequestException('Template media file is required');
    }
    if (!TEMPLATE_MEDIA_TYPES.has(mediaType)) {
      throw new BadRequestException('Template media type is invalid');
    }
    if (!TEMPLATE_MEDIA_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Template media must be jpg, png, or webp');
    }
    const maxBytes = mediaType === 'thumbnail' ? 2 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size <= 0 || file.size > maxBytes) {
      throw new BadRequestException(
        `Template ${mediaType} image must be between 1 byte and ${maxBytes} bytes`,
      );
    }

    const extension = this.resolveImageExtension(file.originalname, file.mimetype);
    const objectKey = this.buildTemplateMediaObjectKey(template.template_key, mediaType, extension);
    const stored = await this.storageAdapter.putObject({
      key: objectKey,
      body: file.buffer,
      contentType: file.mimetype,
    });
    const publicUrl = this.storageAdapter.getPublicUrl(objectKey);

    await this.mediaRepository.create({
      storeId: PLATFORM_MEDIA_NAMESPACE,
      uploadedBy: null,
      bucketName: this.storageAdapter.getBucketName(),
      objectKey,
      publicUrl,
      etag: stored.etag,
      mimeType: file.mimetype,
      fileSizeBytes: file.size,
      metadata: {
        source: 'platform.theme_template',
        templateId: template.id,
        templateKey: template.template_key,
        type: mediaType,
        fileName: file.originalname,
      },
    });

    const currentPreviewImages = template.preview_images ?? [];
    const nextPreviewImages = ['preview', 'mobilePreview', 'desktopPreview'].includes(mediaType)
      ? [...currentPreviewImages, publicUrl]
      : currentPreviewImages;

    return this.updateMedia(id, {
      thumbnailUrl: mediaType === 'thumbnail' ? publicUrl : (template.thumbnail_url ?? undefined),
      previewImageUrl:
        mediaType === 'cover' ? publicUrl : (template.preview_image_url ?? undefined),
      previewImages: nextPreviewImages,
    });
  }

  async updateDesignDefaults(
    id: string,
    input: UpdateTemplateJsonSectionDto,
  ): Promise<PlatformThemeTemplateResponse> {
    const template = await this.findOrThrow(id);
    const config = this.cloneRecord(template.draft_config);
    config.design = input.value;
    return this.update(id, { ...this.toUpsertDto(template), config });
  }

  async updateHomeSectionsDefaults(
    id: string,
    input: UpdateTemplateJsonSectionDto,
  ): Promise<PlatformThemeTemplateResponse> {
    const template = await this.findOrThrow(id);
    const config = setHomeSectionsInConfig(
      template.draft_config,
      Array.isArray(input.value) ? input.value : [],
    );
    return this.update(id, { ...this.toUpsertDto(template), config });
  }

  async updateSettingsSchema(
    id: string,
    input: UpdateTemplateJsonSectionDto,
  ): Promise<PlatformThemeTemplateResponse> {
    const template = await this.findOrThrow(id);
    return this.update(id, { ...this.toUpsertDto(template), settingsSchema: input.value });
  }

  async updateCapabilities(
    id: string,
    input: UpdateTemplateJsonSectionDto,
  ): Promise<PlatformThemeTemplateResponse> {
    const template = await this.findOrThrow(id);
    return this.update(id, { ...this.toUpsertDto(template), capabilities: input.value });
  }

  validate(input: UpsertPlatformThemeTemplateDto): PlatformThemeTemplateValidationResponse {
    const errors: Array<{ path: string; message: string }> = [];
    try {
      this.normalizeInput(input);
    } catch (error) {
      errors.push({
        path: 'template',
        message: error instanceof Error ? error.message : 'Template validation failed',
      });
    }
    return { valid: errors.length === 0, errors };
  }

  private validateRecord(
    template: PlatformThemeTemplateRecord,
  ): Array<{ path: string; message: string }> {
    const errors: Array<{ path: string; message: string }> = [];
    try {
      normalizeThemeConfig(template.draft_config);
      validateThemeSettingsSchema(template.settings_schema);
      this.normalizeCapabilities(template.capabilities);
      if (!template.thumbnail_url) {
        errors.push({
          path: 'thumbnailUrl',
          message: 'Template thumbnail is required before publishing',
        });
      }
      if (!KNOWN_COMPONENT_KEYS.includes(template.component_key)) {
        errors.push({
          path: 'componentKey',
          message: 'Template componentKey is not registered in the storefront registry',
        });
      }
      if (template.preview_images.length === 0 && !template.preview_image_url) {
        errors.push({ path: 'previewImages', message: 'At least one preview image is required' });
      }
      const readiness = this.evaluateProductionReadiness(template);
      if (readiness.status === 'production_ready' && !readiness.passed) {
        errors.push(
          ...readiness.blockingIssues.map((message) => ({ path: 'production', message })),
        );
      }
    } catch (error) {
      errors.push({
        path: 'template',
        message: error instanceof Error ? error.message : 'Template validation failed',
      });
    }
    return errors;
  }

  private async findOrThrow(id: string): Promise<PlatformThemeTemplateRecord> {
    const template = await this.repository.findById(id);
    if (!template) {
      throw new NotFoundException('Theme template not found');
    }
    return template;
  }

  private normalizeInput(input: UpsertPlatformThemeTemplateDto): UpsertPlatformThemeTemplateInput {
    const config = normalizeThemeConfig(input.config);
    const settingsSchema = validateThemeSettingsSchema(input.settingsSchema);
    const templateKey = input.templateKey
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const componentKey = input.componentKey
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (!TEMPLATE_KEY_PATTERN.test(templateKey)) {
      throw new BadRequestException('Template key is invalid');
    }
    if (!KNOWN_COMPONENT_KEYS.includes(componentKey)) {
      throw new BadRequestException('Component key is not registered in the storefront registry');
    }
    if (!VALID_TEMPLATE_CATEGORIES.has(input.category)) {
      throw new BadRequestException('Template category is invalid');
    }

    const template = config.template as Record<string, unknown>;
    if (template.id !== templateKey) {
      throw new BadRequestException('Config template.id must match templateKey');
    }
    if (template.componentKey !== componentKey) {
      throw new BadRequestException('Config template.componentKey must match componentKey');
    }

    const capabilities = this.normalizeCapabilities(input.capabilities ?? {});

    return {
      templateKey,
      name: input.name.trim(),
      description: input.description.trim(),
      category: input.category.trim(),
      componentKey,
      thumbnailUrl: this.cleanOptionalText(input.thumbnailUrl),
      previewImageUrl: this.cleanOptionalText(input.previewImageUrl),
      previewImages: (input.previewImages ?? [])
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 8),
      tags: (input.tags ?? [])
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 12),
      suitableFor: input.suitableFor?.trim() ?? '',
      isPremium: input.isPremium ?? false,
      requiredPlan: this.cleanOptionalText(input.requiredPlan),
      allowedPlans: (input.allowedPlans ?? []).map((value) => value.trim()).filter(Boolean),
      assets: input.assets ?? {},
      settingsSchema,
      capabilities,
      config,
    };
  }

  private normalizeCapabilities(input: Record<string, unknown>): Record<string, unknown> {
    const capabilities = this.asRecord(input) ?? {};
    const production = this.asRecord(capabilities.production) ?? {};
    const status = this.readProductionStatus(production.status);
    const qualityScore = this.readScore(production.qualityScore);

    if (
      production.status !== undefined &&
      (typeof production.status !== 'string' ||
        !VALID_PRODUCTION_STATUSES.has(production.status as TemplateProductionStatus))
    ) {
      throw new BadRequestException('capabilities.production.status is invalid');
    }
    if (production.qualityScore !== undefined && qualityScore === null) {
      throw new BadRequestException(
        'capabilities.production.qualityScore must be between 0 and 100',
      );
    }

    return {
      ...capabilities,
      production: {
        ...production,
        status,
        qualityScore: qualityScore ?? (status === 'production_ready' ? 85 : 60),
      },
    };
  }

  private cleanOptionalText(value: string | undefined): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private auditAccessibility(
    config: Record<string, unknown>,
    capabilities: Record<string, unknown>,
  ): ThemeAccessibilityAudit {
    const accessibility =
      this.asRecord(capabilities.accessibility) ?? this.asRecord(config.accessibility) ?? {};
    const checks = {
      contrastRatio: accessibility.contrastRatio !== false,
      focusStyle: accessibility.focusStyle !== false,
      fontSize: accessibility.fontSize !== false,
      targetSize: accessibility.targetSize !== false,
      reducedMotion: accessibility.reducedMotion !== false,
      altTextCoverage: accessibility.altTextCoverage !== false,
      underlineLinks: accessibility.underlineLinks !== false,
      colorOnlyIndicators: accessibility.colorOnlyIndicators !== false,
    };
    const warnings = Object.entries(checks)
      .filter(([, passed]) => !passed)
      .map(([key]) => `${key} needs review`);
    const criticalIssues = [
      checks.contrastRatio ? null : 'contrast ratio support is missing',
      checks.focusStyle ? null : 'focus style support is missing',
      checks.reducedMotion ? null : 'reduced motion support is missing',
    ].filter((item): item is string => Boolean(item));
    const passedCount = Object.values(checks).filter(Boolean).length;

    return {
      score: Math.round((passedCount / Object.keys(checks).length) * 100),
      criticalIssues,
      warnings,
      checks,
    };
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private toResponse(template: PlatformThemeTemplateRecord): PlatformThemeTemplateResponse {
    const productionReadiness = this.evaluateProductionReadiness(template);
    return {
      id: template.id,
      templateKey: template.template_key,
      name: template.name,
      description: template.description,
      category: template.category,
      rendererType: 'component',
      componentKey: template.component_key,
      thumbnailUrl: template.thumbnail_url,
      previewImageUrl: template.preview_image_url,
      previewImages: template.preview_images,
      tags: template.tags,
      suitableFor: template.suitable_for,
      isPremium: template.is_premium,
      requiredPlan: template.required_plan,
      allowedPlans: template.allowed_plans,
      assets: template.assets,
      settingsSchema: template.settings_schema,
      defaultConfig: normalizeThemeConfig(template.default_config),
      capabilities: template.capabilities,
      accessibilityAudit: this.auditAccessibility(template.draft_config, template.capabilities),
      productionReadiness,
      status: template.status,
      productionStatus: productionReadiness.status,
      qualityScore: productionReadiness.qualityScore,
      version: template.version,
      hasUnpublishedChanges:
        JSON.stringify(template.draft_config) !== JSON.stringify(template.published_config),
      draftConfig: normalizeThemeConfig(template.draft_config),
      publishedConfig: normalizeThemeConfig(template.published_config),
      changelog: template.changelog_entries,
      lastValidatedAt: template.last_validated_at,
      lastProductionCheckAt: template.last_production_check_at,
      publishedAt: template.published_at,
      lastPublishedAt: template.published_at,
      publishedBy: template.published_by,
      archivedAt: template.archived_at,
      updatedAt: template.updated_at,
    };
  }

  private toVersionResponse(
    version: PlatformThemeTemplateVersionRecord,
  ): PlatformThemeTemplateVersionResponse {
    const changeSummary = this.asRecord(version.change_summary) ?? {};
    return {
      id: version.id,
      templateId: version.template_id,
      templateKey: version.template_key,
      version: version.version,
      snapshot: version.config_snapshot ?? version.config,
      settingsSchema: version.settings_schema_snapshot ?? {},
      assets: version.assets_snapshot ?? {},
      capabilities: version.capabilities_snapshot ?? {},
      changelogTitle:
        typeof changeSummary.changelogTitle === 'string'
          ? changeSummary.changelogTitle
          : version.changelog,
      changelogDescription:
        typeof changeSummary.changelogDescription === 'string'
          ? changeSummary.changelogDescription
          : null,
      publishedBy: version.published_by,
      createdAt: version.published_at,
    };
  }

  private toUpsertDto(template: PlatformThemeTemplateRecord): UpsertPlatformThemeTemplateDto {
    return {
      templateKey: template.template_key,
      name: template.name,
      description: template.description,
      category: template.category,
      componentKey: template.component_key,
      thumbnailUrl: template.thumbnail_url ?? undefined,
      previewImageUrl: template.preview_image_url ?? undefined,
      previewImages: template.preview_images,
      tags: template.tags,
      suitableFor: template.suitable_for,
      isPremium: template.is_premium,
      requiredPlan: template.required_plan ?? undefined,
      allowedPlans: template.allowed_plans,
      assets: template.assets,
      settingsSchema: template.settings_schema,
      capabilities: template.capabilities,
      config: normalizeThemeConfig(template.draft_config),
    };
  }

  private cloneRecord(input: Record<string, unknown>): Record<string, unknown> {
    return JSON.parse(JSON.stringify(input)) as Record<string, unknown>;
  }

  private evaluateProductionReadiness(
    template: PlatformThemeTemplateRecord,
  ): TemplateProductionReadiness {
    const capabilities = this.asRecord(template.capabilities) ?? {};
    const production = this.asRecord(capabilities.production) ?? {};
    const supportedPages = this.asRecord(capabilities.supportedPages) ?? {};
    const layout = this.asRecord(capabilities.layout) ?? {};
    const design = this.asRecord(capabilities.design) ?? {};
    const homeSections = this.asRecord(capabilities.homeSections) ?? {};
    const status = this.readProductionStatus(production.status);

    const checks: TemplateProductionReadiness['checks'] = [
      ...REQUIRED_SUPPORTED_PAGES.map(([key, label]) => ({
        key: `supportedPages.${key}`,
        label,
        passed: supportedPages[key] === true,
        weight: key === 'home' || key === 'product' || key === 'checkout' ? 8 : 5,
      })),
      {
        key: 'layout.rtl',
        label: 'RTL tested',
        passed: layout.rtl === true,
        weight: 8,
      },
      {
        key: 'layout.responsive',
        label: 'Responsive layout tested',
        passed: layout.responsive === true && layout.mobileFirst === true,
        weight: 8,
      },
      {
        key: 'design.tokens',
        label: 'Design tokens applied',
        passed:
          design.customColors === true &&
          design.customTypography === true &&
          design.customRadius === true &&
          design.customButtons === true &&
          design.customCards === true,
        weight: 8,
      },
      {
        key: 'pageComposer',
        label: 'Page Composer compatible',
        passed: Object.keys(homeSections).length >= 6,
        weight: 8,
      },
      {
        key: 'accessibility',
        label: 'Accessibility audit has no critical issues',
        passed:
          this.auditAccessibility(template.draft_config, template.capabilities).criticalIssues
            .length === 0,
        weight: 6,
      },
    ];

    const totalWeight = checks.reduce((sum, check) => sum + check.weight, 0);
    const passedWeight = checks
      .filter((check) => check.passed)
      .reduce((sum, check) => sum + check.weight, 0);
    const computedScore = Math.round((passedWeight / totalWeight) * 100);
    const declaredScore = this.readScore(production.qualityScore);
    const qualityScore =
      declaredScore === null ? computedScore : Math.min(declaredScore, computedScore);
    const blockingIssues = checks.filter((check) => !check.passed).map((check) => check.label);
    const warnings = [
      status !== 'production_ready' ? `Template status is ${status}` : null,
      declaredScore !== null && declaredScore > computedScore
        ? 'Declared quality score is higher than readiness checks'
        : null,
    ].filter((item): item is string => Boolean(item));

    return {
      status,
      qualityScore,
      passed: status === 'production_ready' && qualityScore >= 85 && blockingIssues.length === 0,
      checks,
      warnings,
      blockingIssues,
      reviewedAt: typeof production.lastReviewedAt === 'string' ? production.lastReviewedAt : null,
      reviewedBy: typeof production.reviewedBy === 'string' ? production.reviewedBy : null,
    };
  }

  private readProductionStatus(value: unknown): TemplateProductionStatus {
    return typeof value === 'string' &&
      VALID_PRODUCTION_STATUSES.has(value as TemplateProductionStatus)
      ? (value as TemplateProductionStatus)
      : 'experimental';
  }

  private readScore(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100
      ? Math.round(value)
      : null;
  }

  private resolveImageExtension(originalName: string, mimeType: string): string {
    const fromName = path.extname(originalName).replace('.', '').toLowerCase();
    if (['jpg', 'jpeg', 'png', 'webp'].includes(fromName)) {
      return fromName === 'jpeg' ? 'jpg' : fromName;
    }
    if (mimeType === 'image/jpeg') return 'jpg';
    if (mimeType === 'image/png') return 'png';
    return 'webp';
  }

  private buildTemplateMediaObjectKey(
    templateKey: string,
    mediaType: string,
    extension: string,
  ): string {
    const version = uuidv4();
    if (mediaType === 'thumbnail')
      return `theme-templates/${templateKey}/thumbnail-${version}.${extension}`;
    if (mediaType === 'mobilePreview')
      return `theme-templates/${templateKey}/mobile/${version}.${extension}`;
    if (mediaType === 'desktopPreview')
      return `theme-templates/${templateKey}/desktop/${version}.${extension}`;
    if (mediaType === 'cover')
      return `theme-templates/${templateKey}/cover-${version}.${extension}`;
    return `theme-templates/${templateKey}/previews/${version}.${extension}`;
  }

  private getPreviewTokenTtlMinutes(): number {
    const raw = Number(process.env.TEMPLATE_PREVIEW_TOKEN_TTL_MINUTES ?? '60');
    return Number.isInteger(raw) && raw >= 5 && raw <= 24 * 60 ? raw : 60;
  }

  private buildPreviewUrl(templateKey: string, token: string): string {
    const base = process.env.TEMPLATE_PREVIEW_STORE_URL?.trim() || 'http://localhost:3001/preview';
    const url = new URL(base);
    if (url.pathname === '/' || url.pathname === '') {
      url.pathname = '/preview';
    }
    url.searchParams.set('templatePreview', templateKey);
    url.searchParams.set('token', token);
    return url.toString();
  }
}

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import type { RequestContextData } from '../common/utils/request-context.util';
import { OutboxService } from '../messaging/outbox.service';
import type { CreateThemePreviewTokenDto } from './dto/create-theme-preview-token.dto';
import type { UpdateAccessibilitySettingsDto } from './dto/update-accessibility-settings.dto';
import type { ApplyThemeDesignPresetDto } from './dto/apply-theme-design-preset.dto';
import type { UpdateThemeDesignDto } from './dto/update-theme-design.dto';
import type { ValidateThemeDesignContrastDto } from './dto/validate-theme-design-contrast.dto';
import {
  DEFAULT_THEME_DESIGN,
  THEME_DESIGN_PRESETS,
  deepMergeThemeDesign,
  findThemeDesignPreset,
  resolveThemeDesign,
  validateThemeDesignContrast,
  type ThemeContrastResult,
  type ThemeDesign,
  type ThemeDesignPreset,
} from './defaults/theme-design.defaults';
import { normalizeThemeConfig } from './utils/theme-config-normalizer';
import type { UpdateThemeDraftDto } from './dto/update-theme-draft.dto';
import {
  assertThemeAccessibility,
  auditThemeAccessibility,
  type ThemeAccessibilityAudit,
} from './theme-config.validator';
import {
  DEFAULT_HOME_SECTIONS,
  getHomeSectionRegistry,
  validateHomeSections,
} from './theme-home-sections';
import {
  ThemesRepository,
  type StoreThemeRecord,
  type ThemeTemplateCatalogRecord,
  type ThemeVersionRecord,
} from './themes.repository';

export interface ThemeStateResponse {
  storeId: string;
  version: number;
  draftConfig: Record<string, unknown>;
  publishedConfig: Record<string, unknown>;
  status: ThemeEditorStatus;
  templateKey: string | null;
  templateName: string | null;
  draftVersion: number;
  publishedVersion: number;
  hasUnpublishedChanges: boolean;
  lastPublishedAt: Date | null;
}

export type ThemeEditorStatus = 'published' | 'draft' | 'unpublished_changes' | 'not_configured';

export interface ThemePreviewTokenResponse {
  previewToken: string;
  expiresAt: Date;
}

export interface ThemeTemplateSummary {
  id: string;
  templateKey: string;
  name: string;
  description: string;
  category: string;
  rendererType: 'component';
  componentKey: string;
  version: number;
  isPremium: boolean;
  allowedPlans: string[];
  thumbnailUrl: string | null;
  previewImageUrl: string | null;
  previewImages: string[];
  capabilities: Record<string, unknown>;
  settingsSchema: Record<string, unknown>;
  defaultConfig: Record<string, unknown>;
}

export interface ThemeTemplateListResponse {
  items: ThemeTemplateSummary[];
}

export interface ThemeRegistryResponse {
  componentKeys: string[];
}

export interface ThemeVersionResponse {
  id: string;
  storeId: string;
  themeId: string;
  version: number;
  publishedBy: string | null;
  publishedAt: Date;
  changeSummary: Record<string, unknown>;
}

export interface ThemeVersionListResponse {
  items: ThemeVersionResponse[];
}

export interface StorefrontThemeResponse {
  storeId: string;
  mode: 'published' | 'preview';
  version: number;
  config: Record<string, unknown>;
}

export interface ThemeStatusResponse {
  templateKey: string | null;
  templateName: string | null;
  draftVersion: number;
  publishedVersion: number;
  hasUnpublishedChanges: boolean;
  lastPublishedAt: Date | null;
  status: ThemeEditorStatus;
}

export interface ThemeDesignResponse {
  design: ThemeDesign;
  source: 'draft' | 'default';
  hasUnpublishedChanges: boolean;
  contrast: ThemeContrastResult[];
}

export interface ThemeDesignPresetListResponse {
  items: Array<ThemeDesignPreset>;
}

export interface ThemeContrastValidationResponse {
  items: ThemeContrastResult[];
}

export interface ThemeAccessibilityAuditResponse extends ThemeAccessibilityAudit {}

export interface ThemeHomePageResponse {
  sections: unknown[];
}

@Injectable()
export class ThemesService {
  private readonly logger = new Logger(ThemesService.name);

  constructor(
    private readonly themesRepository: ThemesRepository,
    private readonly outboxService: OutboxService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {}

  async listTemplates(): Promise<ThemeTemplateListResponse> {
    const publishedTemplates = await this.themesRepository.listPublishedThemeTemplates();
    return { items: publishedTemplates.map((template) => this.toTemplateSummary(template)) };
  }

  async getRegistry(): Promise<ThemeRegistryResponse> {
    return { componentKeys: await this.themesRepository.listPublishedComponentKeys() };
  }

  getHomeSectionRegistry() {
    return getHomeSectionRegistry();
  }

  async getDraft(currentUser: AuthUser): Promise<ThemeStateResponse> {
    const theme = await this.getOrCreateTheme(currentUser.storeId);
    return this.toStateResponse(theme, await this.getLastPublishedAt(currentUser.storeId));
  }

  async getStatus(currentUser: AuthUser): Promise<ThemeStatusResponse> {
    const theme = await this.getOrCreateTheme(currentUser.storeId);
    return this.buildStatusResponse(theme, await this.getLastPublishedAt(currentUser.storeId));
  }

  async listVersions(currentUser: AuthUser): Promise<ThemeVersionListResponse> {
    await this.getOrCreateTheme(currentUser.storeId);
    const versions = await this.themesRepository.listThemeVersions(currentUser.storeId);
    return { items: versions.map((version) => this.toVersionResponse(version)) };
  }

  async updateDraft(
    currentUser: AuthUser,
    input: UpdateThemeDraftDto,
    context: RequestContextData,
  ): Promise<ThemeStateResponse> {
    const normalizedConfig = this.normalizeThemeConfig(input.config);
    await this.getOrCreateTheme(currentUser.storeId);
    const updated = await this.themesRepository.updateDraft(currentUser.storeId, normalizedConfig);
    await this.logAudit('themes.draft_updated', currentUser, context, { version: updated.version });
    return this.toStateResponse(updated, await this.getLastPublishedAt(currentUser.storeId));
  }

  async applyTemplate(
    currentUser: AuthUser,
    templateKey: string,
    context: RequestContextData,
  ): Promise<ThemeStateResponse> {
    const template = await this.themesRepository.findPublishedThemeTemplateByKeyOrId(templateKey);
    if (!template) {
      throw new BadRequestException('Theme template is invalid');
    }

    await this.getOrCreateTheme(currentUser.storeId);
    const templateConfig = this.cloneConfig(template.published_config);
    templateConfig.template = {
      id: template.template_key,
      renderer: 'component',
      componentKey: template.component_key,
      version: template.version,
      appliedAt: new Date().toISOString(),
    };

    const updated = await this.themesRepository.updateDraft(
      currentUser.storeId,
      this.normalizeThemeConfig(templateConfig),
    );
    await this.logAudit('themes.template_applied', currentUser, context, {
      templateKey: template.template_key,
      templateVersion: template.version,
      version: updated.version,
    });

    return this.toStateResponse(updated, await this.getLastPublishedAt(currentUser.storeId));
  }

  async applyTemplateAndPublish(
    currentUser: AuthUser,
    templateKey: string,
    context: RequestContextData,
  ): Promise<{ ok: true; message: string; theme: Record<string, unknown> }> {
    await this.applyTemplate(currentUser, templateKey, context);
    const published = await this.publish(currentUser, context);
    const template = this.readTemplateMetadata(published.publishedConfig);
    return {
      ok: true,
      message: 'تم تطبيق ونشر القالب على المتجر.',
      theme: {
        templateKey: template?.id ?? templateKey,
        componentKey: template?.componentKey ?? templateKey,
        version: published.version,
        publishedAt: new Date().toISOString(),
      },
    };
  }

  async publish(currentUser: AuthUser, context: RequestContextData): Promise<ThemeStateResponse> {
    const current = await this.getOrCreateTheme(currentUser.storeId);
    const normalizedDraft = this.normalizeThemeConfig(current.draft_config);
    let accessibilityAudit: ThemeAccessibilityAudit;
    try {
      accessibilityAudit = assertThemeAccessibility(normalizedDraft);
    } catch (error) {
      const failedAudit = auditThemeAccessibility(normalizedDraft);
      await this.logAudit('themes.publish_blocked_accessibility', currentUser, context, {
        score: failedAudit.score,
        criticalIssueCount: failedAudit.issues.filter((issue) => issue.severity === 'critical')
          .length,
        seriousIssueCount: failedAudit.issues.filter((issue) => issue.severity === 'serious')
          .length,
      });
      throw error;
    }
    normalizedDraft.accessibilityAudit = accessibilityAudit;
    await this.themesRepository.updateDraft(currentUser.storeId, normalizedDraft);
    const changeSummary = this.buildChangeSummary(current.published_config, normalizedDraft);

    const published = await this.themesRepository.publishDraft(currentUser.storeId);
    await this.themesRepository.createThemeVersion({
      storeId: currentUser.storeId,
      themeId: published.id,
      version: published.version,
      config: this.normalizeThemeConfig(published.published_config),
      publishedBy: currentUser.id,
      changeSummary,
    });

    const invalidationPaths = ['/', '/categories', '/sf/theme'];
    await this.outboxService.enqueue({
      aggregateType: 'store_theme',
      aggregateId: published.id,
      eventType: 'theme.published',
      payload: {
        storeId: currentUser.storeId,
        version: published.version,
        invalidationPaths,
        changeSummary,
      },
    });

    await this.requestStorefrontInvalidation(
      currentUser.storeId,
      published.version,
      invalidationPaths,
    );
    await this.logAudit('themes.published', currentUser, context, {
      version: published.version,
      changeSummary,
    });
    return this.toStateResponse(published, new Date());
  }

  async restoreVersion(
    currentUser: AuthUser,
    version: number,
    context: RequestContextData,
  ): Promise<ThemeStateResponse> {
    if (!Number.isInteger(version) || version < 1) {
      throw new BadRequestException('Theme version is invalid');
    }

    await this.getOrCreateTheme(currentUser.storeId);
    const snapshot = await this.themesRepository.findThemeVersion(currentUser.storeId, version);
    if (!snapshot) {
      throw new NotFoundException('Theme version not found');
    }

    const updated = await this.themesRepository.updateDraft(
      currentUser.storeId,
      this.normalizeThemeConfig(snapshot.config),
    );
    await this.logAudit('themes.version_restored', currentUser, context, {
      restoredVersion: version,
      currentPublishedVersion: updated.version,
    });
    return this.toStateResponse(updated, await this.getLastPublishedAt(currentUser.storeId));
  }

  async restorePublished(
    currentUser: AuthUser,
    context: RequestContextData,
  ): Promise<ThemeStateResponse> {
    const theme = await this.getOrCreateTheme(currentUser.storeId);
    if (!theme.published_config || Object.keys(theme.published_config).length === 0) {
      throw new BadRequestException('No published theme version is available to restore');
    }
    const updated = await this.themesRepository.updateDraft(
      currentUser.storeId,
      this.normalizeThemeConfig(theme.published_config),
    );
    await this.logAudit('themes.published_restored_to_draft', currentUser, context, {
      version: updated.version,
    });
    return this.toStateResponse(updated, await this.getLastPublishedAt(currentUser.storeId));
  }

  async resetTemplate(
    currentUser: AuthUser,
    context: RequestContextData,
  ): Promise<ThemeStateResponse> {
    const theme = await this.getOrCreateTheme(currentUser.storeId);
    const templateKey =
      this.readTemplateId(theme.draft_config) ??
      this.readTemplateId(theme.published_config) ??
      'general-starter';
    const template = await this.themesRepository.findPublishedThemeTemplateByKeyOrId(templateKey);
    const defaultConfig = template?.default_config ?? this.buildDefaultThemeConfig();
    const updated = await this.themesRepository.updateDraft(
      currentUser.storeId,
      this.normalizeThemeConfig(this.cloneConfig(defaultConfig)),
    );
    await this.logAudit('themes.template_reset', currentUser, context, {
      templateKey,
      version: updated.version,
    });
    return this.toStateResponse(updated, await this.getLastPublishedAt(currentUser.storeId));
  }

  async createPreviewToken(
    currentUser: AuthUser,
    input: CreateThemePreviewTokenDto,
    context: RequestContextData,
  ): Promise<ThemePreviewTokenResponse> {
    await this.getOrCreateTheme(currentUser.storeId);
    await this.themesRepository.deleteExpiredPreviewTokens();

    const ttlMinutes =
      input.expiresInMinutes ??
      this.configService.get<number>('THEME_PREVIEW_TOKEN_TTL_MINUTES', 30);
    const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);
    const previewToken = randomBytes(24).toString('hex');

    const token = await this.themesRepository.createPreviewToken(
      currentUser.storeId,
      previewToken,
      expiresAt,
    );
    await this.logAudit('themes.preview_token_created', currentUser, context, {
      expiresAt: token.expires_at.toISOString(),
    });
    return { previewToken: token.token, expiresAt: token.expires_at };
  }

  async getAccessibilityAudit(currentUser: AuthUser): Promise<ThemeAccessibilityAuditResponse> {
    const theme = await this.getOrCreateTheme(currentUser.storeId);
    return auditThemeAccessibility(this.normalizeThemeConfig(theme.draft_config));
  }

  async runAccessibilityAudit(
    currentUser: AuthUser,
    context: RequestContextData,
  ): Promise<ThemeAccessibilityAuditResponse> {
    const theme = await this.getOrCreateTheme(currentUser.storeId);
    const normalizedDraft = this.normalizeThemeConfig(theme.draft_config);
    const audit = auditThemeAccessibility(normalizedDraft);
    normalizedDraft.accessibilityAudit = audit;
    await this.themesRepository.updateDraft(currentUser.storeId, normalizedDraft);
    await this.logAudit('themes.accessibility_audited', currentUser, context, {
      score: audit.score,
      issueCount: audit.issues.length,
      criticalIssueCount: audit.issues.filter((issue) => issue.severity === 'critical').length,
      seriousIssueCount: audit.issues.filter((issue) => issue.severity === 'serious').length,
    });
    return audit;
  }

  async updateAccessibilitySettings(
    currentUser: AuthUser,
    input: UpdateAccessibilitySettingsDto,
    context: RequestContextData,
  ): Promise<ThemeStateResponse> {
    const theme = await this.getOrCreateTheme(currentUser.storeId);
    const normalizedDraft = this.normalizeThemeConfig(theme.draft_config);
    normalizedDraft.accessibility = {
      ...(typeof normalizedDraft.accessibility === 'object' &&
      normalizedDraft.accessibility !== null
        ? (normalizedDraft.accessibility as Record<string, unknown>)
        : {}),
      ...input,
    };
    const validated = this.normalizeThemeConfig(normalizedDraft);
    const updated = await this.themesRepository.updateDraft(currentUser.storeId, validated);
    await this.logAudit('themes.accessibility_settings_updated', currentUser, context, {
      ...input,
    });
    return this.toStateResponse(updated, await this.getLastPublishedAt(currentUser.storeId));
  }

  async getDesign(currentUser: AuthUser): Promise<ThemeDesignResponse> {
    const theme = await this.getOrCreateTheme(currentUser.storeId);
    const design = resolveThemeDesign(theme.draft_config);
    return this.toDesignResponse(theme, design);
  }

  async updateDesign(
    currentUser: AuthUser,
    input: UpdateThemeDesignDto,
    context: RequestContextData,
  ): Promise<ThemeStateResponse> {
    const theme = await this.getOrCreateTheme(currentUser.storeId);
    const draft = this.normalizeThemeConfig(theme.draft_config);
    draft.design = deepMergeThemeDesign(resolveThemeDesign(draft), input.design);
    const updated = await this.themesRepository.updateDraft(
      currentUser.storeId,
      this.normalizeThemeConfig(draft),
    );
    await this.logAudit('themes.design_updated', currentUser, context, {
      changedSections: Object.keys(input.design),
    });
    return this.toStateResponse(updated, await this.getLastPublishedAt(currentUser.storeId));
  }

  async resetDesign(
    currentUser: AuthUser,
    context: RequestContextData,
  ): Promise<ThemeStateResponse> {
    const theme = await this.getOrCreateTheme(currentUser.storeId);
    const templateKey =
      this.readTemplateId(theme.draft_config) ??
      this.readTemplateId(theme.published_config) ??
      'general-starter';
    const template = await this.themesRepository.findPublishedThemeTemplateByKeyOrId(templateKey);
    const templateDefaultDesign = isPlainObject(template?.default_config?.design)
      ? template.default_config.design
      : DEFAULT_THEME_DESIGN;
    const draft = this.normalizeThemeConfig(theme.draft_config);
    draft.design = deepMergeThemeDesign(templateDefaultDesign);
    const updated = await this.themesRepository.updateDraft(
      currentUser.storeId,
      this.normalizeThemeConfig(draft),
    );
    await this.logAudit('themes.design_reset', currentUser, context, { templateKey });
    return this.toStateResponse(updated, await this.getLastPublishedAt(currentUser.storeId));
  }

  async restorePublishedDesign(
    currentUser: AuthUser,
    context: RequestContextData,
  ): Promise<ThemeStateResponse> {
    const theme = await this.getOrCreateTheme(currentUser.storeId);
    const draft = this.normalizeThemeConfig(theme.draft_config);
    draft.design = resolveThemeDesign(theme.published_config);
    const updated = await this.themesRepository.updateDraft(
      currentUser.storeId,
      this.normalizeThemeConfig(draft),
    );
    await this.logAudit('themes.published_design_restored_to_draft', currentUser, context, {
      version: updated.version,
    });
    return this.toStateResponse(updated, await this.getLastPublishedAt(currentUser.storeId));
  }

  async applyDesignPreset(
    currentUser: AuthUser,
    input: ApplyThemeDesignPresetDto,
    context: RequestContextData,
  ): Promise<ThemeStateResponse> {
    const preset = findThemeDesignPreset(input.presetKey);
    if (!preset) {
      throw new BadRequestException('Theme design preset is invalid');
    }
    const theme = await this.getOrCreateTheme(currentUser.storeId);
    const draft = this.normalizeThemeConfig(theme.draft_config);
    draft.design = deepMergeThemeDesign(resolveThemeDesign(draft), preset.design, {
      preset: preset.key,
    });
    const updated = await this.themesRepository.updateDraft(
      currentUser.storeId,
      this.normalizeThemeConfig(draft),
    );
    await this.logAudit('themes.design_preset_applied', currentUser, context, {
      presetKey: preset.key,
    });
    return this.toStateResponse(updated, await this.getLastPublishedAt(currentUser.storeId));
  }

  async listDesignPresets(): Promise<ThemeDesignPresetListResponse> {
    return { items: THEME_DESIGN_PRESETS };
  }

  async getHomePage(currentUser: AuthUser): Promise<ThemeHomePageResponse> {
    const theme = await this.getOrCreateTheme(currentUser.storeId);
    return this.readHomePage(this.normalizeThemeConfig(theme.draft_config));
  }

  async updateHomePage(
    currentUser: AuthUser,
    input: Record<string, unknown>,
    context: RequestContextData,
  ): Promise<ThemeStateResponse> {
    const home: ThemeHomePageResponse = { sections: validateHomeSections(input.sections) };
    const theme = await this.getOrCreateTheme(currentUser.storeId);
    const draft = this.normalizeThemeConfig(theme.draft_config);
    const pages = isPlainObject(draft.pages) ? draft.pages : {};
    const currentHome = isPlainObject(pages.home) ? pages.home : {};
    draft.pages = {
      ...pages,
      home: {
        ...currentHome,
        sections: home.sections,
      },
    };
    const updated = await this.themesRepository.updateDraft(
      currentUser.storeId,
      this.normalizeThemeConfig(draft),
    );
    await this.logAudit('themes.home_page_updated', currentUser, context, {
      sectionCount: home.sections.length,
      version: updated.version,
    });
    return this.toStateResponse(updated, await this.getLastPublishedAt(currentUser.storeId));
  }

  async resetHomePage(
    currentUser: AuthUser,
    context: RequestContextData,
  ): Promise<ThemeStateResponse> {
    const theme = await this.getOrCreateTheme(currentUser.storeId);
    const draft = this.normalizeThemeConfig(theme.draft_config);
    const pages = isPlainObject(draft.pages) ? draft.pages : {};
    const currentHome = isPlainObject(pages.home) ? pages.home : {};
    draft.pages = {
      ...pages,
      home: {
        ...currentHome,
        sections: validateHomeSections(DEFAULT_HOME_SECTIONS),
      },
    };
    const updated = await this.themesRepository.updateDraft(
      currentUser.storeId,
      this.normalizeThemeConfig(draft),
    );
    await this.logAudit('themes.home_page_reset', currentUser, context, {
      version: updated.version,
    });
    return this.toStateResponse(updated, await this.getLastPublishedAt(currentUser.storeId));
  }

  async restorePublishedHomePage(
    currentUser: AuthUser,
    context: RequestContextData,
  ): Promise<ThemeStateResponse> {
    const theme = await this.getOrCreateTheme(currentUser.storeId);
    if (!theme.published_config || Object.keys(theme.published_config).length === 0) {
      throw new BadRequestException('No published theme version is available to restore');
    }
    const draft = this.normalizeThemeConfig(theme.draft_config);
    const publishedHome = this.readHomePage(this.normalizeThemeConfig(theme.published_config));
    const pages = isPlainObject(draft.pages) ? draft.pages : {};
    const currentHome = isPlainObject(pages.home) ? pages.home : {};
    draft.pages = {
      ...pages,
      home: {
        ...currentHome,
        sections: publishedHome.sections,
      },
    };
    const updated = await this.themesRepository.updateDraft(
      currentUser.storeId,
      this.normalizeThemeConfig(draft),
    );
    await this.logAudit('themes.home_page_published_restored_to_draft', currentUser, context, {
      version: updated.version,
    });
    return this.toStateResponse(updated, await this.getLastPublishedAt(currentUser.storeId));
  }

  validateHomePage(input: Record<string, unknown>): ThemeHomePageResponse {
    return { sections: validateHomeSections(input.sections) };
  }

  validateDesignContrast(input: ValidateThemeDesignContrastDto): ThemeContrastValidationResponse {
    return { items: validateThemeDesignContrast(input.colors) };
  }

  async getStorefrontTheme(
    storeId: string,
    previewToken?: string,
  ): Promise<StorefrontThemeResponse> {
    const theme = await this.getOrCreateTheme(storeId);
    if (!previewToken) {
      return {
        storeId,
        mode: 'published',
        version: theme.version,
        config: this.safeConfig(theme.published_config),
      };
    }

    const validToken = await this.themesRepository.findValidPreviewToken(previewToken);
    if (!validToken || validToken.store_id !== storeId) {
      throw new NotFoundException('Preview token is invalid or expired');
    }

    return {
      storeId,
      mode: 'preview',
      version: theme.version,
      config: this.safeConfig(theme.draft_config),
    };
  }

  private safeConfig(config: Record<string, unknown>): Record<string, unknown> {
    try {
      return this.normalizeThemeConfig(config);
    } catch {
      return this.buildDefaultThemeConfig();
    }
  }

  private normalizeThemeConfig(config: Record<string, unknown>): Record<string, unknown> {
    return normalizeThemeConfig(config);
  }

  private async getOrCreateTheme(storeId: string): Promise<StoreThemeRecord> {
    const existing = await this.themesRepository.findByStoreId(storeId);
    if (existing) {
      return existing;
    }

    const created = await this.themesRepository.createDefaultTheme(
      storeId,
      this.buildDefaultThemeConfig(),
    );
    if (created) {
      return created;
    }

    const fallback = await this.themesRepository.findByStoreId(storeId);
    if (!fallback) {
      throw new NotFoundException('Store theme not found');
    }
    return fallback;
  }

  private buildDefaultThemeConfig(): Record<string, unknown> {
    return {
      schemaVersion: 3,
      template: {
        id: 'general-starter',
        key: 'general-starter',
        type: 'component',
        renderer: 'component',
        componentKey: 'general-starter',
        name: 'General Starter',
        version: 3,
      },
      globals: {
        color: {
          primary: '#0f766e',
          primaryStrong: '#115e59',
          primaryContrast: '#ffffff',
          accent: '#f97316',
          bg: '#f8fafc',
          surface: '#ffffff',
          text: '#0f172a',
          textMuted: '#64748b',
          line: '#e2e8f0',
          success: '#16a34a',
          warning: '#f59e0b',
        },
      },
      design: DEFAULT_THEME_DESIGN,
      settings: {
        appearance: {
          headerStyle: 'clean',
          cardRadius: 'soft',
        },
        hero: {
          eyebrow: 'متجر جاهز للبيع بثقة',
          headline: 'اكتشف أفضل اختيارات متجرنا',
          subheadline:
            'واجهة متجر حديثة تضع المنتجات المهمة، التصنيفات، والثقة الشرائية أمام العميل من أول زيارة.',
          primaryCtaLabel: 'تسوق المنتجات',
          primaryCtaHref: '/categories',
          imageUrl: '',
        },
        sections: {
          showTrustStrip: true,
          showOfferBand: true,
          showCategories: true,
          showFeaturedProducts: true,
        },
        offer: {
          label: 'عرض المتجر',
          title: 'ابدأ رحلة الشراء من التصنيفات الأكثر طلباً',
          href: '/categories',
        },
        badges: ['دفع آمن', 'توصيل واضح', 'استبدال مرن'],
        products: {
          source: 'featured',
          limit: 8,
        },
      },
      pages: {
        home: {
          sections: validateHomeSections(DEFAULT_HOME_SECTIONS),
        },
      },
      layout: {},
      accessibility: {
        reducedMotion: false,
      },
    };
  }

  private cloneConfig(config: Record<string, unknown>): Record<string, unknown> {
    return JSON.parse(JSON.stringify(config)) as Record<string, unknown>;
  }

  private buildChangeSummary(
    publishedConfig: Record<string, unknown>,
    draftConfig: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      changed: JSON.stringify(publishedConfig) !== JSON.stringify(draftConfig),
      templateId: this.readTemplateId(draftConfig),
    };
  }

  private readTemplateId(config: Record<string, unknown>): string | null {
    return this.readTemplateMetadata(config)?.id ?? null;
  }

  private readTemplateMetadata(
    config: Record<string, unknown>,
  ): { id?: string; componentKey?: string } | null {
    const template = config.template;
    if (typeof template !== 'object' || template === null || Array.isArray(template)) {
      return null;
    }
    const record = template as Record<string, unknown>;
    return {
      id: typeof record.id === 'string' ? record.id : undefined,
      componentKey: typeof record.componentKey === 'string' ? record.componentKey : undefined,
    };
  }

  private async getLastPublishedAt(storeId: string): Promise<Date | null> {
    const versions = await this.themesRepository.listThemeVersions(storeId, 1);
    return versions[0]?.published_at ?? null;
  }

  private buildStatusResponse(
    theme: StoreThemeRecord,
    lastPublishedAt: Date | null,
  ): ThemeStatusResponse {
    const draftTemplate = this.readTemplateMetadata(theme.draft_config);
    const publishedTemplate = this.readTemplateMetadata(theme.published_config);
    const hasUnpublishedChanges =
      JSON.stringify(this.safeConfig(theme.draft_config)) !==
      JSON.stringify(this.safeConfig(theme.published_config));
    const templateKey = draftTemplate?.id ?? publishedTemplate?.id ?? null;
    const templateName =
      this.readTemplateName(theme.draft_config) ?? this.readTemplateName(theme.published_config);
    return {
      templateKey,
      templateName,
      draftVersion: theme.version + (hasUnpublishedChanges ? 1 : 0),
      publishedVersion: theme.version,
      hasUnpublishedChanges,
      lastPublishedAt,
      status: templateKey
        ? hasUnpublishedChanges
          ? 'unpublished_changes'
          : 'published'
        : 'not_configured',
    };
  }

  private readTemplateName(config: Record<string, unknown>): string | null {
    const template = config.template;
    if (!isPlainObject(template)) {
      return null;
    }
    return typeof template.name === 'string' && template.name.trim() ? template.name.trim() : null;
  }

  private toDesignResponse(theme: StoreThemeRecord, design: ThemeDesign): ThemeDesignResponse {
    const colors = isPlainObject(design.colors) ? design.colors : {};
    return {
      design,
      source: isPlainObject(theme.draft_config.design) ? 'draft' : 'default',
      hasUnpublishedChanges:
        JSON.stringify(theme.draft_config) !== JSON.stringify(theme.published_config),
      contrast: validateThemeDesignContrast(colors),
    };
  }

  private async requestStorefrontInvalidation(
    storeId: string,
    version: number,
    paths: string[],
  ): Promise<void> {
    const webhookUrl = this.configService
      .get<string>('STOREFRONT_REVALIDATE_WEBHOOK_URL', '')
      .trim();
    const secret = this.configService.get<string>('STOREFRONT_REVALIDATE_SECRET', '').trim();
    if (!webhookUrl) {
      this.logger.warn(
        'STOREFRONT_REVALIDATE_WEBHOOK_URL is not configured; storefront invalidation skipped',
      );
      return;
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(secret ? { 'x-revalidate-secret': secret } : {}),
        },
        body: JSON.stringify({
          storeId,
          version,
          paths,
          tags: [`store:${storeId}:theme`, `store:${storeId}:home`],
        }),
      });
      if (!response.ok) {
        this.logger.error(`Storefront invalidation failed with status ${response.status}`);
      }
    } catch (error) {
      this.logger.error(
        'Storefront invalidation request failed',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async logAudit(
    action: string,
    currentUser: AuthUser,
    context: RequestContextData,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.auditService.log({
      action,
      storeId: currentUser.storeId,
      storeUserId: currentUser.id,
      targetType: 'store_theme',
      targetId: currentUser.storeId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        ...metadata,
        ...(context.requestId ? { requestId: context.requestId } : {}),
      },
    });
  }

  private toStateResponse(
    theme: StoreThemeRecord,
    lastPublishedAt: Date | null = null,
  ): ThemeStateResponse {
    const status = this.buildStatusResponse(theme, lastPublishedAt);
    return {
      storeId: theme.store_id,
      version: theme.version,
      draftConfig: this.safeConfig(theme.draft_config),
      publishedConfig: this.safeConfig(theme.published_config),
      ...status,
    };
  }

  private toVersionResponse(version: ThemeVersionRecord): ThemeVersionResponse {
    return {
      id: version.id,
      storeId: version.store_id,
      themeId: version.theme_id,
      version: version.version,
      publishedBy: version.published_by,
      publishedAt: version.published_at,
      changeSummary: version.change_summary,
    };
  }

  private toTemplateSummary(template: ThemeTemplateCatalogRecord): ThemeTemplateSummary {
    return {
      id: template.id,
      templateKey: template.template_key,
      name: template.name,
      description: template.description,
      category: template.category,
      rendererType: 'component',
      componentKey: template.component_key,
      version: template.version,
      isPremium: template.is_premium,
      allowedPlans: template.allowed_plans,
      thumbnailUrl: template.thumbnail_url,
      previewImageUrl: template.preview_image_url,
      previewImages: template.preview_images,
      capabilities: template.capabilities,
      settingsSchema: template.settings_schema,
      defaultConfig: this.normalizeThemeConfig(template.default_config),
    };
  }

  private readHomePage(config: Record<string, unknown>): ThemeHomePageResponse {
    const pages = isPlainObject(config.pages) ? config.pages : {};
    const home = isPlainObject(pages.home) ? pages.home : {};
    return { sections: validateHomeSections(home.sections ?? DEFAULT_HOME_SECTIONS) };
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

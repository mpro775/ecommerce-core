import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';

export interface StoreThemeRecord {
  id: string;
  store_id: string;
  draft_config: Record<string, unknown>;
  published_config: Record<string, unknown>;
  version: number;
}

export interface ThemePreviewTokenRecord {
  id: string;
  store_id: string;
  token: string;
  expires_at: Date;
}

export interface ThemeVersionRecord {
  id: string;
  store_id: string;
  theme_id: string;
  version: number;
  config: Record<string, unknown>;
  published_by: string | null;
  published_at: Date;
  change_summary: Record<string, unknown>;
}

export interface ThemeTemplateCatalogRecord {
  id: string;
  template_key: string;
  name: string;
  description: string;
  category: string;
  renderer_type: 'component';
  component_key: string;
  thumbnail_url: string | null;
  preview_image_url: string | null;
  preview_images: string[];
  assets: Record<string, unknown>;
  settings_schema: Record<string, unknown>;
  default_config: Record<string, unknown>;
  capabilities: Record<string, unknown>;
  is_premium: boolean;
  allowed_plans: string[];
  status: 'draft' | 'published' | 'archived';
  version: number;
  draft_config: Record<string, unknown>;
  published_config: Record<string, unknown>;
  published_at: Date | null;
  updated_at: Date;
}

const MERCHANT_VISIBLE_PRODUCTION_STATUSES = ['production_ready', 'beta'];
const MERCHANT_VISIBLE_TEMPLATE_ALLOWLIST = ['general-starter', 'electronics-pro', 'beauty-luxe'];

@Injectable()
export class ThemesRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async findByStoreId(storeId: string): Promise<StoreThemeRecord | null> {
    const result = await this.databaseService.db.query<StoreThemeRecord>(
      `
        SELECT id, store_id, draft_config, published_config, version
        FROM store_themes
        WHERE store_id = $1
        LIMIT 1
      `,
      [storeId],
    );
    return result.rows[0] ?? null;
  }

  async createDefaultTheme(
    storeId: string,
    config: Record<string, unknown>,
  ): Promise<StoreThemeRecord | null> {
    const result = await this.databaseService.db.query<StoreThemeRecord>(
      `
        INSERT INTO store_themes (
          id,
          store_id,
          draft_config,
          published_config,
          version
        ) VALUES ($1, $2, $3::jsonb, $3::jsonb, 1)
        ON CONFLICT (store_id) DO NOTHING
        RETURNING id, store_id, draft_config, published_config, version
      `,
      [uuidv4(), storeId, JSON.stringify(config)],
    );
    return result.rows[0] ?? null;
  }

  async updateDraft(storeId: string, config: Record<string, unknown>): Promise<StoreThemeRecord> {
    const result = await this.databaseService.db.query<StoreThemeRecord>(
      `
        UPDATE store_themes
        SET draft_config = $2::jsonb,
            updated_at = NOW()
        WHERE store_id = $1
        RETURNING id, store_id, draft_config, published_config, version
      `,
      [storeId, JSON.stringify(config)],
    );
    return result.rows[0] as StoreThemeRecord;
  }

  async publishDraft(storeId: string): Promise<StoreThemeRecord> {
    const result = await this.databaseService.db.query<StoreThemeRecord>(
      `
        UPDATE store_themes
        SET published_config = draft_config,
            version = version + 1,
            updated_at = NOW()
        WHERE store_id = $1
        RETURNING id, store_id, draft_config, published_config, version
      `,
      [storeId],
    );
    return result.rows[0] as StoreThemeRecord;
  }

  async createThemeVersion(input: {
    storeId: string;
    themeId: string;
    version: number;
    config: Record<string, unknown>;
    publishedBy: string | null;
    changeSummary: Record<string, unknown>;
  }): Promise<ThemeVersionRecord> {
    const result = await this.databaseService.db.query<ThemeVersionRecord>(
      `
        INSERT INTO theme_versions (
          id,
          store_id,
          theme_id,
          version,
          config,
          published_by,
          change_summary
        ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb)
        ON CONFLICT (store_id, version) DO UPDATE
        SET config = EXCLUDED.config,
            published_by = EXCLUDED.published_by,
            change_summary = EXCLUDED.change_summary
        RETURNING id, store_id, theme_id, version, config, published_by, published_at, change_summary
      `,
      [
        uuidv4(),
        input.storeId,
        input.themeId,
        input.version,
        JSON.stringify(input.config),
        input.publishedBy,
        JSON.stringify(input.changeSummary),
      ],
    );
    return result.rows[0] as ThemeVersionRecord;
  }

  async listThemeVersions(storeId: string, limit = 20): Promise<ThemeVersionRecord[]> {
    const result = await this.databaseService.db.query<ThemeVersionRecord>(
      `
        SELECT id, store_id, theme_id, version, config, published_by, published_at, change_summary
        FROM theme_versions
        WHERE store_id = $1
        ORDER BY version DESC
        LIMIT $2
      `,
      [storeId, limit],
    );
    return result.rows;
  }

  async findThemeVersion(storeId: string, version: number): Promise<ThemeVersionRecord | null> {
    const result = await this.databaseService.db.query<ThemeVersionRecord>(
      `
        SELECT id, store_id, theme_id, version, config, published_by, published_at, change_summary
        FROM theme_versions
        WHERE store_id = $1
          AND version = $2
        LIMIT 1
      `,
      [storeId, version],
    );
    return result.rows[0] ?? null;
  }

  async createPreviewToken(
    storeId: string,
    token: string,
    expiresAt: Date,
  ): Promise<ThemePreviewTokenRecord> {
    const result = await this.databaseService.db.query<ThemePreviewTokenRecord>(
      `
        INSERT INTO theme_preview_tokens (
          id,
          store_id,
          token,
          expires_at
        ) VALUES ($1, $2, $3, $4)
        RETURNING id, store_id, token, expires_at
      `,
      [uuidv4(), storeId, token, expiresAt],
    );
    return result.rows[0] as ThemePreviewTokenRecord;
  }

  async findValidPreviewToken(token: string): Promise<ThemePreviewTokenRecord | null> {
    const result = await this.databaseService.db.query<ThemePreviewTokenRecord>(
      `
        SELECT id, store_id, token, expires_at
        FROM theme_preview_tokens
        WHERE token = $1
          AND expires_at > NOW()
        LIMIT 1
      `,
      [token],
    );
    return result.rows[0] ?? null;
  }

  async deleteExpiredPreviewTokens(): Promise<void> {
    await this.databaseService.db.query(
      `
        DELETE FROM theme_preview_tokens
        WHERE expires_at <= NOW()
      `,
    );
  }

  async listPublishedThemeTemplates(): Promise<ThemeTemplateCatalogRecord[]> {
    const result = await this.databaseService.db.query<ThemeTemplateCatalogRecord>(
      `
        SELECT
          id,
          template_key,
          name,
          description,
          category,
          renderer_type,
          component_key,
          thumbnail_url,
          preview_image_url,
          preview_images,
          assets,
          settings_schema,
          default_config,
          capabilities,
          is_premium,
          allowed_plans,
          status,
          version,
          draft_config,
          published_config,
          published_at,
          updated_at
        FROM theme_templates
        WHERE status = 'published'
          AND renderer_type = 'component'
          AND (
            capabilities #>> '{production,status}' = ANY($1::text[])
            OR (capabilities #>> '{production,status}' IS NULL AND template_key = ANY($2::text[]))
          )
        ORDER BY is_premium DESC, updated_at DESC, name ASC
      `,
      [MERCHANT_VISIBLE_PRODUCTION_STATUSES, MERCHANT_VISIBLE_TEMPLATE_ALLOWLIST],
    );
    return result.rows;
  }

  async listPublishedComponentKeys(): Promise<string[]> {
    const result = await this.databaseService.db.query<{ component_key: string }>(
      `
        SELECT DISTINCT component_key
        FROM theme_templates
        WHERE status = 'published'
          AND renderer_type = 'component'
          AND (
            capabilities #>> '{production,status}' = ANY($1::text[])
            OR (capabilities #>> '{production,status}' IS NULL AND template_key = ANY($2::text[]))
          )
        ORDER BY component_key ASC
      `,
      [MERCHANT_VISIBLE_PRODUCTION_STATUSES, MERCHANT_VISIBLE_TEMPLATE_ALLOWLIST],
    );
    return result.rows.map((row) => row.component_key);
  }

  async findPublishedThemeTemplateByKeyOrId(
    identifier: string,
  ): Promise<ThemeTemplateCatalogRecord | null> {
    const result = await this.databaseService.db.query<ThemeTemplateCatalogRecord>(
      `
        SELECT
          id,
          template_key,
          name,
          description,
          category,
          renderer_type,
          component_key,
          thumbnail_url,
          preview_image_url,
          preview_images,
          assets,
          settings_schema,
          default_config,
          capabilities,
          is_premium,
          allowed_plans,
          status,
          version,
          draft_config,
          published_config,
          published_at,
          updated_at
        FROM theme_templates
        WHERE status = 'published'
          AND renderer_type = 'component'
          AND (
            capabilities #>> '{production,status}' = ANY($2::text[])
            OR (capabilities #>> '{production,status}' IS NULL AND template_key = ANY($3::text[]))
          )
          AND (template_key = $1 OR id::text = $1)
        LIMIT 1
      `,
      [identifier, MERCHANT_VISIBLE_PRODUCTION_STATUSES, MERCHANT_VISIBLE_TEMPLATE_ALLOWLIST],
    );
    return result.rows[0] ?? null;
  }
}

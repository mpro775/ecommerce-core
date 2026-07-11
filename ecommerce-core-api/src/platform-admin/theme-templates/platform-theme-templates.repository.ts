import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../../database/database.service';

export type PlatformThemeTemplateStatus = 'draft' | 'published' | 'archived';

export interface PlatformThemeTemplateRecord {
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
  tags: string[];
  suitable_for: string;
  is_premium: boolean;
  required_plan: string | null;
  allowed_plans: string[];
  assets: Record<string, unknown>;
  settings_schema: Record<string, unknown>;
  default_config: Record<string, unknown>;
  capabilities: Record<string, unknown>;
  status: PlatformThemeTemplateStatus;
  version: number;
  draft_config: Record<string, unknown>;
  published_config: Record<string, unknown>;
  changelog_entries: PlatformThemeTemplateChangelogRecord[];
  last_validated_at: Date | null;
  last_production_check_at: Date | null;
  published_at: Date | null;
  published_by: string | null;
  archived_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface PlatformThemeTemplateChangelogRecord {
  version: number;
  title: string;
  description: string | null;
  type:
    | 'created'
    | 'updated'
    | 'published'
    | 'archived'
    | 'restored'
    | 'duplicated'
    | 'validated'
    | 'production_checked';
  createdAt: string;
  createdBy: string | null;
}

export interface PlatformThemeTemplateVersionRecord {
  id: string;
  template_id: string;
  template_key: string | null;
  version: number;
  config: Record<string, unknown>;
  config_snapshot: Record<string, unknown> | null;
  settings_schema_snapshot: Record<string, unknown> | null;
  assets_snapshot: Record<string, unknown> | null;
  capabilities_snapshot: Record<string, unknown> | null;
  change_summary: Record<string, unknown>;
  published_by: string | null;
  published_at: Date;
  changelog: string | null;
}

export interface PlatformThemeTemplatePreviewTokenRecord {
  id: string;
  token: string;
  template_id: string;
  template_key: string;
  config_snapshot: Record<string, unknown>;
  settings_schema_snapshot: Record<string, unknown>;
  assets_snapshot: Record<string, unknown>;
  capabilities_snapshot: Record<string, unknown>;
  expires_at: Date;
  created_at: Date;
}

export interface PlatformThemeTemplateListFilters {
  search?: string;
  status?: string;
  productionStatus?: string;
  category?: string;
  isPremium?: boolean;
  page: number;
  limit: number;
}

export interface UpsertPlatformThemeTemplateInput {
  templateKey: string;
  name: string;
  description: string;
  category: string;
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
  capabilities: Record<string, unknown>;
  config: Record<string, unknown>;
}

export interface CreatePlatformThemeTemplatePreviewTokenInput {
  token: string;
  templateId: string;
  templateKey: string;
  configSnapshot: Record<string, unknown>;
  settingsSchemaSnapshot: Record<string, unknown>;
  assetsSnapshot: Record<string, unknown>;
  capabilitiesSnapshot: Record<string, unknown>;
  expiresAt: Date;
}

@Injectable()
export class PlatformThemeTemplatesRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async list(
    filters: PlatformThemeTemplateListFilters,
  ): Promise<{ items: PlatformThemeTemplateRecord[]; total: number }> {
    const where: string[] = [];
    const values: unknown[] = [];

    if (filters.search) {
      values.push(`%${filters.search}%`);
      where.push(
        `(template_key ILIKE $${values.length} OR name ILIKE $${values.length} OR description ILIKE $${values.length})`,
      );
    }
    if (filters.status) {
      values.push(filters.status);
      where.push(`status = $${values.length}`);
    }
    if (filters.productionStatus) {
      values.push(filters.productionStatus);
      where.push(
        `COALESCE(capabilities #>> '{production,status}', 'experimental') = $${values.length}`,
      );
    }
    if (filters.category) {
      values.push(filters.category);
      where.push(`category = $${values.length}`);
    }
    if (filters.isPremium !== undefined) {
      values.push(filters.isPremium);
      where.push(`is_premium = $${values.length}`);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const countResult = await this.databaseService.db.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM theme_templates ${whereSql}`,
      values,
    );

    values.push(filters.limit, (filters.page - 1) * filters.limit);
    const result = await this.databaseService.db.query<PlatformThemeTemplateRecord>(
      this.baseSelect(`
        ${whereSql}
        ORDER BY updated_at DESC, name ASC
        LIMIT $${values.length - 1}
        OFFSET $${values.length}
      `),
      values,
    );
    return { items: result.rows, total: Number(countResult.rows[0]?.total ?? 0) };
  }

  async listComponentKeys(): Promise<string[]> {
    const result = await this.databaseService.db.query<{ component_key: string }>(
      `
        SELECT DISTINCT component_key
        FROM theme_templates
        WHERE renderer_type = 'component'
          AND component_key <> ''
        ORDER BY component_key ASC
      `,
    );
    return result.rows.map((row) => row.component_key);
  }

  async findById(id: string): Promise<PlatformThemeTemplateRecord | null> {
    const result = await this.databaseService.db.query<PlatformThemeTemplateRecord>(
      this.baseSelect(`
        WHERE id = $1
        LIMIT 1
      `),
      [id],
    );
    return result.rows[0] ?? null;
  }

  async templateKeyExists(templateKey: string): Promise<boolean> {
    const result = await this.databaseService.db.query<{ exists: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM theme_templates
          WHERE template_key = $1
        ) AS exists
      `,
      [templateKey],
    );
    return result.rows[0]?.exists === true;
  }

  async create(input: UpsertPlatformThemeTemplateInput): Promise<PlatformThemeTemplateRecord> {
    const result = await this.databaseService.db.query<PlatformThemeTemplateRecord>(
      `
        INSERT INTO theme_templates (
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
          tags,
          suitable_for,
          is_premium,
          required_plan,
          allowed_plans,
          assets,
          settings_schema,
          default_config,
          capabilities,
          status,
          draft_config
        ) VALUES ($1, $2, $3, $4, $5, 'component', $6, $7, $8, $9::jsonb, $10::text[], $11, $12, $13, $14::text[], $15::jsonb, $16::jsonb, $17::jsonb, $18::jsonb, 'draft', $17::jsonb)
        RETURNING *
      `,
      [
        uuidv4(),
        input.templateKey,
        input.name,
        input.description,
        input.category,
        input.componentKey,
        input.thumbnailUrl,
        input.previewImageUrl,
        JSON.stringify(input.previewImages),
        input.tags,
        input.suitableFor,
        input.isPremium,
        input.requiredPlan,
        input.allowedPlans,
        JSON.stringify(input.assets),
        JSON.stringify(input.settingsSchema),
        JSON.stringify(input.config),
        JSON.stringify(input.capabilities),
      ],
    );
    return result.rows[0] as PlatformThemeTemplateRecord;
  }

  async update(
    id: string,
    input: UpsertPlatformThemeTemplateInput,
  ): Promise<PlatformThemeTemplateRecord> {
    const result = await this.databaseService.db.query<PlatformThemeTemplateRecord>(
      `
        UPDATE theme_templates
        SET template_key = $2,
            name = $3,
            description = $4,
            category = $5,
            renderer_type = 'component',
            component_key = $6,
            thumbnail_url = $7,
            preview_image_url = $8,
            preview_images = $9::jsonb,
            tags = $10::text[],
            suitable_for = $11,
            is_premium = $12,
            required_plan = $13,
            allowed_plans = $14::text[],
            assets = $15::jsonb,
            settings_schema = $16::jsonb,
            default_config = $17::jsonb,
            capabilities = $18::jsonb,
            draft_config = $17::jsonb,
            status = CASE WHEN status = 'archived' THEN 'draft' ELSE status END,
            archived_at = CASE WHEN status = 'archived' THEN NULL ELSE archived_at END,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [
        id,
        input.templateKey,
        input.name,
        input.description,
        input.category,
        input.componentKey,
        input.thumbnailUrl,
        input.previewImageUrl,
        JSON.stringify(input.previewImages),
        input.tags,
        input.suitableFor,
        input.isPremium,
        input.requiredPlan,
        input.allowedPlans,
        JSON.stringify(input.assets),
        JSON.stringify(input.settingsSchema),
        JSON.stringify(input.config),
        JSON.stringify(input.capabilities),
      ],
    );
    return result.rows[0] as PlatformThemeTemplateRecord;
  }

  async publish(
    id: string,
    publishedBy: string,
    changelogVersion: number,
    changelogTitle: string,
    changelogDescription: string | null,
  ): Promise<PlatformThemeTemplateRecord> {
    const result = await this.databaseService.db.query<PlatformThemeTemplateRecord>(
      `
        UPDATE theme_templates
        SET published_config = draft_config,
            version = version + 1,
            status = 'published',
            published_at = NOW(),
            published_by = $2,
            changelog_entries = COALESCE(changelog_entries, '[]'::jsonb) || $3::jsonb,
            archived_at = NULL,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [
        id,
        publishedBy,
        JSON.stringify([
          this.buildChangelogEntry({
            version: changelogVersion,
            title: changelogTitle,
            description: changelogDescription,
            type: 'published',
            createdBy: publishedBy,
          }),
        ]),
      ],
    );
    const template = result.rows[0] as PlatformThemeTemplateRecord;
    await this.databaseService.db.query(
      `
        INSERT INTO theme_template_versions (
          id,
          template_id,
          template_key,
          version,
          config,
          config_snapshot,
          settings_schema_snapshot,
          assets_snapshot,
          capabilities_snapshot,
          change_summary,
          published_by,
          changelog
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10, $11)
        ON CONFLICT (template_id, version) DO NOTHING
      `,
      [
        uuidv4(),
        id,
        template.template_key,
        template.version,
        JSON.stringify(template.published_config),
        JSON.stringify(template.settings_schema),
        JSON.stringify(template.assets),
        JSON.stringify(template.capabilities),
        JSON.stringify({
          source: 'platform_admin',
          rendererType: 'component',
          componentKey: template.component_key,
          changelogTitle,
          changelogDescription,
        }),
        publishedBy,
        changelogTitle,
      ],
    );
    return template;
  }

  async archive(
    id: string,
    archivedBy: string | null = null,
  ): Promise<PlatformThemeTemplateRecord> {
    const result = await this.databaseService.db.query<PlatformThemeTemplateRecord>(
      `
        UPDATE theme_templates
        SET status = 'archived',
            archived_at = NOW(),
            changelog_entries = COALESCE(changelog_entries, '[]'::jsonb) || $2::jsonb,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [
        id,
        JSON.stringify([
          this.buildChangelogEntry({
            version: 0,
            title: 'Template archived',
            description: null,
            type: 'archived',
            createdBy: archivedBy,
          }),
        ]),
      ],
    );
    return result.rows[0] as PlatformThemeTemplateRecord;
  }

  async restore(
    id: string,
    restoredBy: string | null = null,
  ): Promise<PlatformThemeTemplateRecord> {
    const result = await this.databaseService.db.query<PlatformThemeTemplateRecord>(
      `
        UPDATE theme_templates
        SET status = 'draft',
            archived_at = NULL,
            changelog_entries = COALESCE(changelog_entries, '[]'::jsonb) || $2::jsonb,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [
        id,
        JSON.stringify([
          this.buildChangelogEntry({
            version: 0,
            title: 'Template restored',
            description: null,
            type: 'restored',
            createdBy: restoredBy,
          }),
        ]),
      ],
    );
    return result.rows[0] as PlatformThemeTemplateRecord;
  }

  async duplicate(
    id: string,
    duplicatedBy: string | null = null,
    input: { templateKey?: string; name?: string } = {},
  ): Promise<PlatformThemeTemplateRecord> {
    const newId = uuidv4();
    const result = await this.databaseService.db.query<PlatformThemeTemplateRecord>(
      `
        INSERT INTO theme_templates (
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
          tags,
          suitable_for,
          is_premium,
          required_plan,
          allowed_plans,
          assets,
          settings_schema,
          default_config,
          capabilities,
          status,
          draft_config,
          published_config,
          changelog_entries
        )
        SELECT
          $1,
          COALESCE($4, template_key || '-copy-' || substr($1::text, 1, 8)),
          COALESCE($5, name || ' Copy'),
          description,
          category,
          'component',
          component_key,
          thumbnail_url,
          preview_image_url,
          preview_images,
          tags,
          suitable_for,
          is_premium,
          required_plan,
          allowed_plans,
          assets,
          settings_schema,
          default_config,
          capabilities,
          'draft',
          draft_config,
          '{}'::jsonb,
          $3::jsonb
        FROM theme_templates
        WHERE id = $2
        RETURNING *
      `,
      [
        newId,
        id,
        JSON.stringify([
          this.buildChangelogEntry({
            version: 1,
            title: 'Template duplicated',
            description: `Duplicated from ${id}`,
            type: 'duplicated',
            createdBy: duplicatedBy,
          }),
        ]),
        input.templateKey ?? null,
        input.name ?? null,
      ],
    );
    return result.rows[0] as PlatformThemeTemplateRecord;
  }

  async createPreviewToken(
    input: CreatePlatformThemeTemplatePreviewTokenInput,
  ): Promise<PlatformThemeTemplatePreviewTokenRecord> {
    const result = await this.databaseService.db.query<PlatformThemeTemplatePreviewTokenRecord>(
      `
        INSERT INTO platform_theme_template_preview_tokens (
          id,
          token,
          template_id,
          template_key,
          config_snapshot,
          settings_schema_snapshot,
          assets_snapshot,
          capabilities_snapshot,
          expires_at
        ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9)
        RETURNING *
      `,
      [
        uuidv4(),
        input.token,
        input.templateId,
        input.templateKey,
        JSON.stringify(input.configSnapshot),
        JSON.stringify(input.settingsSchemaSnapshot),
        JSON.stringify(input.assetsSnapshot),
        JSON.stringify(input.capabilitiesSnapshot),
        input.expiresAt,
      ],
    );
    return result.rows[0] as PlatformThemeTemplatePreviewTokenRecord;
  }

  async findValidPreviewToken(
    token: string,
    templateKey?: string,
  ): Promise<PlatformThemeTemplatePreviewTokenRecord | null> {
    const values: unknown[] = [token];
    const templateFilter = templateKey ? 'AND template_key = $2' : '';
    if (templateKey) values.push(templateKey);
    const result = await this.databaseService.db.query<PlatformThemeTemplatePreviewTokenRecord>(
      `
        SELECT *
        FROM platform_theme_template_preview_tokens
        WHERE token = $1
          AND expires_at > NOW()
          ${templateFilter}
        LIMIT 1
      `,
      values,
    );
    return result.rows[0] ?? null;
  }

  async markValidated(
    id: string,
    validatedBy: string | null = null,
  ): Promise<PlatformThemeTemplateRecord> {
    const result = await this.databaseService.db.query<PlatformThemeTemplateRecord>(
      `
        UPDATE theme_templates
        SET last_validated_at = NOW(),
            changelog_entries = COALESCE(changelog_entries, '[]'::jsonb) || $2::jsonb,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [
        id,
        JSON.stringify([
          this.buildChangelogEntry({
            version: 0,
            title: 'Template validated',
            description: null,
            type: 'validated',
            createdBy: validatedBy,
          }),
        ]),
      ],
    );
    return result.rows[0] as PlatformThemeTemplateRecord;
  }

  async markProductionChecked(
    id: string,
    checkedBy: string | null = null,
  ): Promise<PlatformThemeTemplateRecord> {
    const result = await this.databaseService.db.query<PlatformThemeTemplateRecord>(
      `
        UPDATE theme_templates
        SET last_production_check_at = NOW(),
            changelog_entries = COALESCE(changelog_entries, '[]'::jsonb) || $2::jsonb,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [
        id,
        JSON.stringify([
          this.buildChangelogEntry({
            version: 0,
            title: 'Production check completed',
            description: null,
            type: 'production_checked',
            createdBy: checkedBy,
          }),
        ]),
      ],
    );
    return result.rows[0] as PlatformThemeTemplateRecord;
  }

  async listVersions(templateId: string): Promise<PlatformThemeTemplateVersionRecord[]> {
    const result = await this.databaseService.db.query<PlatformThemeTemplateVersionRecord>(
      `
        SELECT
          id,
          template_id,
          template_key,
          version,
          config,
          config_snapshot,
          settings_schema_snapshot,
          assets_snapshot,
          capabilities_snapshot,
          change_summary,
          published_by,
          published_at,
          changelog
        FROM theme_template_versions
        WHERE template_id = $1
        ORDER BY version DESC
      `,
      [templateId],
    );
    return result.rows;
  }

  async findVersion(
    templateId: string,
    version: number,
  ): Promise<PlatformThemeTemplateVersionRecord | null> {
    const result = await this.databaseService.db.query<PlatformThemeTemplateVersionRecord>(
      `
        SELECT
          id,
          template_id,
          template_key,
          version,
          config,
          config_snapshot,
          settings_schema_snapshot,
          assets_snapshot,
          capabilities_snapshot,
          change_summary,
          published_by,
          published_at,
          changelog
        FROM theme_template_versions
        WHERE template_id = $1
          AND version = $2
        LIMIT 1
      `,
      [templateId, version],
    );
    return result.rows[0] ?? null;
  }

  async restoreVersionDraft(
    id: string,
    version: PlatformThemeTemplateVersionRecord,
    restoredBy: string | null = null,
  ): Promise<PlatformThemeTemplateRecord> {
    const result = await this.databaseService.db.query<PlatformThemeTemplateRecord>(
      `
        UPDATE theme_templates
        SET draft_config = COALESCE($2::jsonb, config_snapshot, config),
            default_config = COALESCE($2::jsonb, config_snapshot, config),
            settings_schema = COALESCE(settings_schema_snapshot, settings_schema),
            assets = COALESCE(assets_snapshot, assets),
            capabilities = COALESCE(capabilities_snapshot, capabilities),
            status = CASE WHEN status = 'archived' THEN 'draft' ELSE status END,
            archived_at = CASE WHEN status = 'archived' THEN NULL ELSE archived_at END,
            changelog_entries = COALESCE(changelog_entries, '[]'::jsonb) || $4::jsonb,
            updated_at = NOW()
        FROM theme_template_versions
        WHERE theme_templates.id = $1
          AND theme_template_versions.template_id = theme_templates.id
          AND theme_template_versions.version = $3
        RETURNING theme_templates.*
      `,
      [
        id,
        JSON.stringify(version.config_snapshot ?? version.config),
        version.version,
        JSON.stringify([
          this.buildChangelogEntry({
            version: 0,
            title: `Version ${version.version} restored to draft`,
            description: null,
            type: 'restored',
            createdBy: restoredBy,
          }),
        ]),
      ],
    );
    return result.rows[0] as PlatformThemeTemplateRecord;
  }

  private baseSelect(tail: string): string {
    return `
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
        tags,
        suitable_for,
        is_premium,
        required_plan,
        allowed_plans,
        assets,
        settings_schema,
        default_config,
        capabilities,
        status,
        version,
        draft_config,
        published_config,
        COALESCE(changelog_entries, '[]'::jsonb) AS changelog_entries,
        last_validated_at,
        last_production_check_at,
        published_at,
        published_by,
        archived_at,
        created_at,
        updated_at
      FROM theme_templates
      ${tail}
    `;
  }

  private buildChangelogEntry(input: {
    version: number;
    title: string;
    description: string | null;
    type: PlatformThemeTemplateChangelogRecord['type'];
    createdBy: string | null;
  }): PlatformThemeTemplateChangelogRecord {
    return {
      version: input.version,
      title: input.title,
      description: input.description,
      type: input.type,
      createdAt: new Date().toISOString(),
      createdBy: input.createdBy,
    };
  }
}

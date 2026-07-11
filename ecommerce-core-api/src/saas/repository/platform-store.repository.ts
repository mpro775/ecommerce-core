import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../../database/database.service';
import type {
  Queryable,
  PlatformStoreRecord,
  StoreDeletionPreviewRecord,
  PlatformAuditActivityRecord,
  PlatformStoreNoteRecord,
} from './types';

@Injectable()
export class PlatformStoreRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async findPlatformStoreById(storeId: string): Promise<PlatformStoreRecord | null> {
    const result = await this.databaseService.db.query<PlatformStoreRecord>(
      `
        SELECT
          s.id,
          s.name,
          s.slug,
          COALESCE(s.status, CASE WHEN s.is_suspended THEN 'suspended' ELSE 'active' END) AS status,
          s.is_suspended,
          s.suspension_reason,
          s.deleted_at,
          s.deleted_by_platform_admin_id,
          s.deletion_reason,
          s.purge_status,
          s.purge_started_at,
          s.purge_completed_at,
          s.purge_error,
          s.created_at,
          p.code AS plan_code,
          ss.status AS subscription_status,
          COALESCE(dom.total_domains, 0)::int AS total_domains,
          COALESCE(dom.active_domains, 0)::int AS active_domains
        FROM stores s
        LEFT JOIN store_subscriptions ss
          ON ss.store_id = s.id
         AND ss.is_current = TRUE
        LEFT JOIN plans p
          ON p.id = ss.plan_id
        LEFT JOIN LATERAL (
          SELECT
            COUNT(*)::int AS total_domains,
            COUNT(*) FILTER (WHERE status = 'active')::int AS active_domains
          FROM store_domains d
          WHERE d.store_id = s.id
        ) dom ON TRUE
        WHERE s.id = $1
        LIMIT 1
      `,
      [storeId],
    );

    return result.rows[0] ?? null;
  }

  async listPlatformStores(input: {
    q: string | null;
    planCode: string | null;
    subscriptionStatus: string | null;
    isSuspended: boolean | null;
    limit: number;
    offset: number;
  }): Promise<{ rows: PlatformStoreRecord[]; total: number }> {
    const rowsResult = await this.databaseService.db.query<PlatformStoreRecord>(
      `
        SELECT
          s.id,
          s.name,
          s.slug,
          COALESCE(s.status, CASE WHEN s.is_suspended THEN 'suspended' ELSE 'active' END) AS status,
          s.is_suspended,
          s.suspension_reason,
          s.deleted_at,
          s.deleted_by_platform_admin_id,
          s.deletion_reason,
          s.purge_status,
          s.purge_started_at,
          s.purge_completed_at,
          s.purge_error,
          s.created_at,
          p.code AS plan_code,
          ss.status AS subscription_status,
          COALESCE(dom.total_domains, 0)::int AS total_domains,
          COALESCE(dom.active_domains, 0)::int AS active_domains
        FROM stores s
        LEFT JOIN store_subscriptions ss
          ON ss.store_id = s.id
         AND ss.is_current = TRUE
        LEFT JOIN plans p
          ON p.id = ss.plan_id
        LEFT JOIN LATERAL (
          SELECT
            COUNT(*)::int AS total_domains,
            COUNT(*) FILTER (WHERE status = 'active')::int AS active_domains
          FROM store_domains d
          WHERE d.store_id = s.id
        ) dom ON TRUE
        WHERE ($1::text IS NULL OR s.name ILIKE '%' || $1 || '%' OR s.slug ILIKE '%' || $1 || '%')
          AND ($2::text IS NULL OR p.code = $2)
          AND ($3::text IS NULL OR ss.status = $3)
          AND ($4::boolean IS NULL OR s.is_suspended = $4)
        ORDER BY s.created_at DESC
        LIMIT $5 OFFSET $6
      `,
      [
        input.q,
        input.planCode,
        input.subscriptionStatus,
        input.isSuspended,
        input.limit,
        input.offset,
      ],
    );

    const countResult = await this.databaseService.db.query<{ total: string }>(
      `
        SELECT COUNT(*)::text AS total
        FROM stores s
        LEFT JOIN store_subscriptions ss
          ON ss.store_id = s.id
         AND ss.is_current = TRUE
        LEFT JOIN plans p
          ON p.id = ss.plan_id
        WHERE ($1::text IS NULL OR s.name ILIKE '%' || $1 || '%' OR s.slug ILIKE '%' || $1 || '%')
          AND ($2::text IS NULL OR p.code = $2)
          AND ($3::text IS NULL OR ss.status = $3)
          AND ($4::boolean IS NULL OR s.is_suspended = $4)
      `,
      [input.q, input.planCode, input.subscriptionStatus, input.isSuspended],
    );

    return {
      rows: rowsResult.rows,
      total: Number(countResult.rows[0]?.total ?? '0'),
    };
  }

  async setStoreSuspension(
    input: {
      storeId: string;
      isSuspended: boolean;
      reason: string | null;
    },
    db?: Queryable,
  ): Promise<boolean> {
    const queryable = db ?? this.databaseService.db;
    const result = await queryable.query(
      `
        UPDATE stores
        SET is_suspended = $2,
            suspension_reason = $3,
            status = CASE WHEN $2 THEN 'suspended' ELSE 'active' END,
            suspended_at = CASE WHEN $2 THEN NOW() ELSE NULL END,
            updated_at = NOW()
        WHERE id = $1
          AND COALESCE(status, 'active') <> 'deleted'
      `,
      [input.storeId, input.isSuspended, input.reason],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async isStoreSuspended(storeId: string): Promise<boolean> {
    const result = await this.databaseService.db.query<{ is_suspended: boolean; status: string }>(
      `
        SELECT is_suspended, COALESCE(status, CASE WHEN is_suspended THEN 'suspended' ELSE 'active' END) AS status
        FROM stores
        WHERE id = $1
        LIMIT 1
      `,
      [storeId],
    );
    return Boolean(result.rows[0]?.is_suspended) || result.rows[0]?.status === 'deleted';
  }

  async getStoreDeletionPreview(storeId: string): Promise<StoreDeletionPreviewRecord | null> {
    const result = await this.databaseService.db.query<StoreDeletionPreviewRecord>(
      `
        SELECT
          s.id,
          s.name,
          s.slug,
          COALESCE(s.status, CASE WHEN s.is_suspended THEN 'suspended' ELSE 'active' END) AS status,
          s.is_suspended,
          s.deleted_at,
          s.deletion_reason,
          s.purge_status,
          owner.id AS owner_user_id,
          owner.email AS owner_email,
          COALESCE((SELECT COUNT(*) FROM orders o WHERE o.store_id = s.id), 0)::int AS orders_count,
          COALESCE((SELECT COUNT(*) FROM products p WHERE p.store_id = s.id), 0)::int AS products_count,
          COALESCE((SELECT COUNT(*) FROM store_domains d WHERE d.store_id = s.id), 0)::int AS domains_count,
          EXISTS (
            SELECT 1
            FROM store_subscriptions ss
            WHERE ss.store_id = s.id
              AND ss.is_current = TRUE
              AND ss.status IN ('trialing', 'active', 'past_due')
          ) AS has_active_subscription,
          EXISTS (
            SELECT 1
            FROM platform_risk_violations rv
            WHERE rv.store_id = s.id
              AND rv.status IN ('open', 'investigating', 'accepted')
          ) AS has_open_disputes,
          EXISTS (
            SELECT 1
            FROM payments p
            WHERE p.store_id = s.id
              AND p.status IN ('pending', 'under_review')
          ) OR EXISTS (
            SELECT 1
            FROM subscription_payments sp
            WHERE sp.store_id = s.id
              AND sp.status = 'pending'
          ) AS has_pending_payments
        FROM stores s
        LEFT JOIN LATERAL (
          SELECT id, email
          FROM store_users su
          WHERE su.store_id = s.id
            AND su.role = 'owner'
          ORDER BY su.created_at ASC
          LIMIT 1
        ) owner ON TRUE
        WHERE s.id = $1
        LIMIT 1
      `,
      [storeId],
    );
    return result.rows[0] ?? null;
  }

  async findPlatformStoreByIdForUpdate(
    storeId: string,
    db: Queryable,
  ): Promise<PlatformStoreRecord | null> {
    const result = await db.query<PlatformStoreRecord>(
      `
        SELECT
          s.id,
          s.name,
          s.slug,
          COALESCE(s.status, CASE WHEN s.is_suspended THEN 'suspended' ELSE 'active' END) AS status,
          s.is_suspended,
          s.suspension_reason,
          s.deleted_at,
          s.deleted_by_platform_admin_id,
          s.deletion_reason,
          s.purge_status,
          s.purge_started_at,
          s.purge_completed_at,
          s.purge_error,
          s.created_at,
          p.code AS plan_code,
          ss.status AS subscription_status,
          COALESCE(dom.total_domains, 0)::int AS total_domains,
          COALESCE(dom.active_domains, 0)::int AS active_domains
        FROM stores s
        LEFT JOIN store_subscriptions ss
          ON ss.store_id = s.id
         AND ss.is_current = TRUE
        LEFT JOIN plans p
          ON p.id = ss.plan_id
        LEFT JOIN LATERAL (
          SELECT
            COUNT(*)::int AS total_domains,
            COUNT(*) FILTER (WHERE status = 'active')::int AS active_domains
          FROM store_domains d
          WHERE d.store_id = s.id
        ) dom ON TRUE
        WHERE s.id = $1
        LIMIT 1
        FOR UPDATE OF s
      `,
      [storeId],
    );
    return result.rows[0] ?? null;
  }

  async markStoreDeleted(
    input: {
      storeId: string;
      platformAdminId: string;
      reason: string;
      purgeStatus: 'pending' | 'not_started';
    },
    db: Queryable,
  ): Promise<void> {
    await db.query(
      `
        UPDATE stores
        SET status = 'deleted',
            is_suspended = TRUE,
            suspension_reason = $3,
            suspended_at = NOW(),
            deleted_at = NOW(),
            deleted_by_platform_admin_id = $2,
            deletion_reason = $3,
            purge_status = $4,
            purge_error = NULL,
            updated_at = NOW()
        WHERE id = $1
      `,
      [input.storeId, input.platformAdminId, input.reason, input.purgeStatus],
    );
  }

  async anonymizeStoreUsers(
    storeId: string,
    db: Queryable,
  ): Promise<
    Array<{
      id: string;
      original_email: string;
      anonymized_email: string;
    }>
  > {
    const result = await db.query<{ id: string; original_email: string; anonymized_email: string }>(
      `
        WITH candidates AS (
          SELECT
            id,
            email AS original_email,
            'deleted+' || id::text || '@deleted.kaleem.local' AS anonymized_email
          FROM store_users
          WHERE store_id = $1
            AND deleted_at IS NULL
        )
        UPDATE store_users su
        SET email = candidates.anonymized_email,
            is_active = FALSE,
            deleted_at = NOW(),
            anonymized_at = NOW(),
            original_email_hash = encode(digest(lower(trim(candidates.original_email)), 'sha256'), 'hex'),
            updated_at = NOW()
        FROM candidates
        WHERE su.id = candidates.id
        RETURNING su.id, candidates.original_email, candidates.anonymized_email
      `,
      [storeId],
    );
    return result.rows;
  }

  async revokeStoreSessions(storeId: string, db: Queryable): Promise<number> {
    const result = await db.query(
      `
        UPDATE sessions
        SET revoked_at = NOW(),
            updated_at = NOW()
        WHERE store_id = $1
          AND revoked_at IS NULL
      `,
      [storeId],
    );
    return result.rowCount ?? 0;
  }

  async disableStoreDomains(storeId: string, db: Queryable): Promise<number> {
    const result = await db.query(
      `
        UPDATE store_domains
        SET status = 'disabled',
            support_required = FALSE,
            technical_error_code = NULL,
            technical_error_message = NULL,
            updated_at = NOW()
        WHERE store_id = $1
          AND status <> 'disabled'
      `,
      [storeId],
    );
    return result.rowCount ?? 0;
  }

  async createStoreDeletionPurgeJob(
    input: {
      storeId: string;
      platformAdminId: string;
      metadata: Record<string, unknown>;
    },
    db: Queryable,
  ): Promise<string> {
    const id = uuidv4();
    await db.query(
      `
        INSERT INTO store_deletion_purge_jobs (
          id,
          store_id,
          requested_by_platform_admin_id,
          status,
          metadata
        ) VALUES ($1, $2, $3, 'pending', $4::jsonb)
      `,
      [id, input.storeId, input.platformAdminId, JSON.stringify(input.metadata)],
    );
    return id;
  }

  async getStoreDeletionStatus(storeId: string): Promise<{
    store_id: string;
    status: string;
    deleted_at: Date | null;
    deleted_by_platform_admin_id: string | null;
    deletion_reason: string | null;
    purge_status: string;
    purge_started_at: Date | null;
    purge_completed_at: Date | null;
    purge_error: string | null;
    latest_purge_job_id: string | null;
    latest_purge_job_status: string | null;
    latest_purge_job_attempts: number | null;
    latest_purge_job_error: string | null;
  } | null> {
    const result = await this.databaseService.db.query<{
      store_id: string;
      status: string;
      deleted_at: Date | null;
      deleted_by_platform_admin_id: string | null;
      deletion_reason: string | null;
      purge_status: string;
      purge_started_at: Date | null;
      purge_completed_at: Date | null;
      purge_error: string | null;
      latest_purge_job_id: string | null;
      latest_purge_job_status: string | null;
      latest_purge_job_attempts: number | null;
      latest_purge_job_error: string | null;
    }>(
      `
        SELECT
          s.id AS store_id,
          s.status,
          s.deleted_at,
          s.deleted_by_platform_admin_id,
          s.deletion_reason,
          s.purge_status,
          s.purge_started_at,
          s.purge_completed_at,
          s.purge_error,
          job.id AS latest_purge_job_id,
          job.status AS latest_purge_job_status,
          job.attempts AS latest_purge_job_attempts,
          job.last_error AS latest_purge_job_error
        FROM stores s
        LEFT JOIN LATERAL (
          SELECT id, status, attempts, last_error
          FROM store_deletion_purge_jobs j
          WHERE j.store_id = s.id
          ORDER BY j.requested_at DESC
          LIMIT 1
        ) job ON TRUE
        WHERE s.id = $1
        LIMIT 1
      `,
      [storeId],
    );
    return result.rows[0] ?? null;
  }

  async retryStoreDeletionPurge(input: {
    storeId: string;
    platformAdminId: string;
    reason: string | null;
  }): Promise<string> {
    return this.withTransaction(async (db) => {
      await db.query(
        `
          UPDATE stores
          SET purge_status = 'pending',
              purge_error = NULL,
              updated_at = NOW()
          WHERE id = $1
            AND status = 'deleted'
        `,
        [input.storeId],
      );
      return this.createStoreDeletionPurgeJob(
        {
          storeId: input.storeId,
          platformAdminId: input.platformAdminId,
          metadata: { retry: true, reason: input.reason },
        },
        db,
      );
    });
  }

  async listStoreAuditActivity(
    storeId: string,
    limit: number,
  ): Promise<PlatformAuditActivityRecord[]> {
    const result = await this.databaseService.db.query<PlatformAuditActivityRecord>(
      `
        SELECT
          id,
          action,
          target_type,
          target_id,
          metadata,
          created_at,
          store_id
        FROM audit_logs
        WHERE store_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      `,
      [storeId, limit],
    );

    return result.rows;
  }

  async listStoreNotes(storeId: string, limit: number): Promise<PlatformStoreNoteRecord[]> {
    const result = await this.databaseService.db.query<PlatformStoreNoteRecord>(
      `
        SELECT
          n.id,
          n.store_id,
          n.author_admin_id,
          u.full_name AS author_name,
          n.type,
          n.body,
          n.pinned,
          n.created_at,
          n.updated_at
        FROM platform_store_notes n
        LEFT JOIN platform_admin_users u
          ON u.id = n.author_admin_id
        WHERE n.store_id = $1
        ORDER BY n.pinned DESC, n.created_at DESC
        LIMIT $2
      `,
      [storeId, limit],
    );
    return result.rows;
  }

  async createStoreNote(input: {
    storeId: string;
    authorAdminId: string;
    type: string;
    body: string;
    pinned: boolean;
  }): Promise<PlatformStoreNoteRecord> {
    const result = await this.databaseService.db.query<PlatformStoreNoteRecord>(
      `
        INSERT INTO platform_store_notes (
          id,
          store_id,
          author_admin_id,
          type,
          body,
          pinned,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING
          id,
          store_id,
          author_admin_id,
          NULL::text AS author_name,
          type,
          body,
          pinned,
          created_at,
          updated_at
      `,
      [uuidv4(), input.storeId, input.authorAdminId, input.type, input.body, input.pinned],
    );

    return result.rows[0] as PlatformStoreNoteRecord;
  }

  async listAuditLogsByTarget(
    targetType: string,
    targetId: string,
  ): Promise<PlatformAuditActivityRecord[]> {
    const result = await this.databaseService.db.query<PlatformAuditActivityRecord>(
      `
        SELECT
          id,
          action,
          target_type,
          target_id,
          metadata,
          created_at,
          store_id
        FROM audit_logs
        WHERE target_type = $1
          AND target_id = $2
        ORDER BY created_at ASC
      `,
      [targetType, targetId],
    );
    return result.rows;
  }

  async withTransaction<T>(callback: (db: Queryable) => Promise<T>): Promise<T> {
    const client = await this.databaseService.db.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

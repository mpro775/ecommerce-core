import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import type { PlatformDashboardSummaryRecord, PlatformAuditActivityRecord } from './types';

@Injectable()
export class PlatformDashboardRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async getPlatformDashboardSummary(): Promise<PlatformDashboardSummaryRecord> {
    const result = await this.databaseService.db.query<PlatformDashboardSummaryRecord>(
      `
        SELECT
          (SELECT COUNT(*)::text FROM stores WHERE COALESCE(status, 'active') <> 'deleted') AS total_stores,
          (SELECT COUNT(*)::text FROM stores WHERE COALESCE(status, 'active') = 'active' AND is_suspended = FALSE) AS active_stores,
          (SELECT COUNT(*)::text FROM stores WHERE COALESCE(status, 'active') = 'suspended' OR (is_suspended = TRUE AND COALESCE(status, 'active') <> 'deleted')) AS suspended_stores,
          (SELECT COUNT(*)::text FROM store_subscriptions WHERE is_current = TRUE) AS total_subscriptions,
          (SELECT COUNT(*)::text FROM store_subscriptions WHERE is_current = TRUE AND status = 'active') AS active_subscriptions,
          (SELECT COUNT(*)::text FROM store_subscriptions WHERE is_current = TRUE AND status = 'trialing') AS trialing_subscriptions,
          (SELECT COUNT(*)::text FROM store_subscriptions WHERE is_current = TRUE AND status = 'past_due') AS past_due_subscriptions,
          (SELECT COUNT(*)::text FROM store_subscriptions WHERE is_current = TRUE AND status = 'canceled') AS canceled_subscriptions,
          (SELECT COUNT(*)::text FROM store_domains) AS total_domains,
          (
            SELECT COUNT(*)::text
            FROM store_domains
            WHERE ssl_status = 'error'
               OR status = 'pending'
          ) AS domain_issues
      `,
    );

    return result.rows[0] as PlatformDashboardSummaryRecord;
  }

  async getPlatformGrowthSummary(): Promise<{
    newStores7d: number;
    newStores30d: number;
    trialingSubscriptions: number;
    paidSubscriptions: number;
  }> {
    const result = await this.databaseService.db.query<{
      new_stores_7d: string;
      new_stores_30d: string;
      trialing_subscriptions: string;
      paid_subscriptions: string;
    }>(
      `
        SELECT
          (
            SELECT COUNT(*)::text
            FROM stores
            WHERE created_at >= NOW() - INTERVAL '7 days'
              AND COALESCE(status, 'active') <> 'deleted'
          ) AS new_stores_7d,
          (
            SELECT COUNT(*)::text
            FROM stores
            WHERE created_at >= NOW() - INTERVAL '30 days'
              AND COALESCE(status, 'active') <> 'deleted'
          ) AS new_stores_30d,
          (
            SELECT COUNT(*)::text
            FROM store_subscriptions
            WHERE is_current = TRUE
              AND status = 'trialing'
          ) AS trialing_subscriptions,
          (
            SELECT COUNT(*)::text
            FROM store_subscriptions
            WHERE is_current = TRUE
              AND status = 'active'
          ) AS paid_subscriptions
      `,
    );

    const row = result.rows[0];
    return {
      newStores7d: Number(row?.new_stores_7d ?? '0'),
      newStores30d: Number(row?.new_stores_30d ?? '0'),
      trialingSubscriptions: Number(row?.trialing_subscriptions ?? '0'),
      paidSubscriptions: Number(row?.paid_subscriptions ?? '0'),
    };
  }

  async getPlatformMrrChurnSummary(): Promise<{
    mrr: number;
    arr: number;
    activePaidSubscriptions: number;
    canceledIn30d: number;
    churnRate30d: number;
  }> {
    const result = await this.databaseService.db.query<{
      mrr: string;
      arr: string;
      active_paid_subscriptions: string;
      canceled_in_30d: string;
      churn_rate_30d: string;
    }>(
      `
        WITH current_paid AS (
          SELECT ss.id, ss.status, ss.updated_at, ss.starts_at, p.monthly_price
          FROM store_subscriptions ss
          INNER JOIN plans p ON p.id = ss.plan_id
          WHERE ss.is_current = TRUE
            AND ss.status = 'active'
            AND COALESCE(p.monthly_price, 0) > 0
        )
        SELECT
          COALESCE(SUM(monthly_price), 0)::text AS mrr,
          (COALESCE(SUM(monthly_price), 0) * 12)::text AS arr,
          COUNT(*)::text AS active_paid_subscriptions,
          (
            SELECT COUNT(*)::text
            FROM store_subscriptions ss2
            INNER JOIN plans p2 ON p2.id = ss2.plan_id
            WHERE ss2.status = 'canceled'
              AND ss2.updated_at >= NOW() - INTERVAL '30 days'
              AND COALESCE(p2.monthly_price, 0) > 0
          ) AS canceled_in_30d,
          CASE
            WHEN COUNT(*) = 0 THEN '0'
            ELSE (
              (
                SELECT COUNT(*)::numeric
                FROM store_subscriptions ss3
                INNER JOIN plans p3 ON p3.id = ss3.plan_id
                WHERE ss3.status = 'canceled'
                  AND ss3.updated_at >= NOW() - INTERVAL '30 days'
                  AND COALESCE(p3.monthly_price, 0) > 0
              ) / COUNT(*)::numeric
            )::text
          END AS churn_rate_30d
        FROM current_paid
      `,
    );

    const row = result.rows[0];
    return {
      mrr: Number(row?.mrr ?? '0'),
      arr: Number(row?.arr ?? '0'),
      activePaidSubscriptions: Number(row?.active_paid_subscriptions ?? '0'),
      canceledIn30d: Number(row?.canceled_in_30d ?? '0'),
      churnRate30d: Number(row?.churn_rate_30d ?? '0'),
    };
  }

  async getPlatformCohorts(): Promise<
    Array<{
      cohort_month: string;
      signups: number;
      paid_within_30d: number;
      conversion_rate_30d: number;
    }>
  > {
    const result = await this.databaseService.db.query<{
      cohort_month: string;
      signups: number;
      paid_within_30d: number;
      conversion_rate_30d: string;
    }>(
      `
        WITH cohorts AS (
          SELECT
            s.id AS store_id,
            DATE_TRUNC('month', s.created_at) AS cohort_month,
            s.created_at
          FROM stores s
          WHERE s.created_at >= NOW() - INTERVAL '12 months'
            AND COALESCE(s.status, 'active') <> 'deleted'
        ),
        paid_in_30d AS (
          SELECT DISTINCT c.store_id
          FROM cohorts c
          INNER JOIN store_subscriptions ss
            ON ss.store_id = c.store_id
           AND ss.status = 'active'
          INNER JOIN plans p ON p.id = ss.plan_id
          WHERE COALESCE(p.monthly_price, 0) > 0
            AND ss.starts_at <= c.created_at + INTERVAL '30 days'
        )
        SELECT
          TO_CHAR(c.cohort_month, 'YYYY-MM') AS cohort_month,
          COUNT(*)::int AS signups,
          COUNT(*) FILTER (WHERE c.store_id IN (SELECT store_id FROM paid_in_30d))::int AS paid_within_30d,
          CASE
            WHEN COUNT(*) = 0 THEN '0'
            ELSE (
              COUNT(*) FILTER (WHERE c.store_id IN (SELECT store_id FROM paid_in_30d))::numeric / COUNT(*)::numeric
            )::text
          END AS conversion_rate_30d
        FROM cohorts c
        GROUP BY c.cohort_month
        ORDER BY c.cohort_month DESC
      `,
    );

    return result.rows.map((row) => ({
      cohort_month: row.cohort_month,
      signups: Number(row.signups ?? 0),
      paid_within_30d: Number(row.paid_within_30d ?? 0),
      conversion_rate_30d: Number(row.conversion_rate_30d ?? '0'),
    }));
  }

  async getPlatformFunnelSummary(): Promise<{
    signups30d: number;
    activated30d: number;
    paid30d: number;
    activationRate: number;
    paidRate: number;
  }> {
    const result = await this.databaseService.db.query<{
      signups_30d: string;
      activated_30d: string;
      paid_30d: string;
      activation_rate: string;
      paid_rate: string;
    }>(
      `
        WITH base AS (
          SELECT id, created_at
          FROM stores
          WHERE created_at >= NOW() - INTERVAL '30 days'
            AND COALESCE(status, 'active') <> 'deleted'
        ),
        activated AS (
          SELECT DISTINCT b.id
          FROM base b
          WHERE EXISTS (SELECT 1 FROM products p WHERE p.store_id = b.id)
            AND EXISTS (SELECT 1 FROM store_domains d WHERE d.store_id = b.id AND d.status = 'active')
        ),
        paid AS (
          SELECT DISTINCT b.id
          FROM base b
          INNER JOIN store_subscriptions ss ON ss.store_id = b.id
          INNER JOIN plans p ON p.id = ss.plan_id
          WHERE ss.status = 'active'
            AND COALESCE(p.monthly_price, 0) > 0
        )
        SELECT
          (SELECT COUNT(*)::text FROM base) AS signups_30d,
          (SELECT COUNT(*)::text FROM activated) AS activated_30d,
          (SELECT COUNT(*)::text FROM paid) AS paid_30d,
          CASE
            WHEN (SELECT COUNT(*) FROM base) = 0 THEN '0'
            ELSE ((SELECT COUNT(*)::numeric FROM activated) / (SELECT COUNT(*)::numeric FROM base))::text
          END AS activation_rate,
          CASE
            WHEN (SELECT COUNT(*) FROM base) = 0 THEN '0'
            ELSE ((SELECT COUNT(*)::numeric FROM paid) / (SELECT COUNT(*)::numeric FROM base))::text
          END AS paid_rate
      `,
    );

    const row = result.rows[0];
    return {
      signups30d: Number(row?.signups_30d ?? '0'),
      activated30d: Number(row?.activated_30d ?? '0'),
      paid30d: Number(row?.paid_30d ?? '0'),
      activationRate: Number(row?.activation_rate ?? '0'),
      paidRate: Number(row?.paid_rate ?? '0'),
    };
  }

  async listPlatformDashboardAlerts(limit: number): Promise<
    Array<{
      type: string;
      severity: string;
      reference_id: string;
      title: string;
      created_at: Date;
    }>
  > {
    const result = await this.databaseService.db.query<{
      type: string;
      severity: string;
      reference_id: string;
      title: string;
      created_at: Date;
    }>(
      `
        SELECT *
        FROM (
          SELECT
            'subscription'::text AS type,
            CASE WHEN ss.status = 'past_due' THEN 'critical' ELSE 'warning' END AS severity,
            ss.store_id::text AS reference_id,
            ('Subscription ' || ss.status || ' for store ' || s.name) AS title,
            ss.updated_at AS created_at
          FROM store_subscriptions ss
          INNER JOIN stores s ON s.id = ss.store_id
          WHERE ss.is_current = TRUE
            AND ss.status IN ('past_due', 'suspended')
          UNION ALL
          SELECT
            'domain'::text AS type,
            CASE WHEN d.ssl_status = 'error' THEN 'critical' ELSE 'warning' END AS severity,
            d.id::text AS reference_id,
            ('Domain issue: ' || d.hostname) AS title,
            d.updated_at AS created_at
          FROM store_domains d
          WHERE d.ssl_status = 'error'
             OR d.status = 'pending'
        ) alerts
        ORDER BY created_at DESC
        LIMIT $1
      `,
      [limit],
    );

    return result.rows;
  }

  async listRecentPlatformAuditActivity(limit: number): Promise<PlatformAuditActivityRecord[]> {
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
        ORDER BY created_at DESC
        LIMIT $1
      `,
      [limit],
    );
    return result.rows;
  }

  async listPlatformAuditLogs(input: {
    q: string | null;
    action: string | null;
    storeId: string | null;
    limit: number;
    offset: number;
  }): Promise<{ rows: PlatformAuditActivityRecord[]; total: number }> {
    const rowsResult = await this.databaseService.db.query<PlatformAuditActivityRecord>(
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
        WHERE ($1::text IS NULL OR action = $1)
          AND ($2::uuid IS NULL OR store_id = $2)
          AND (
            $3::text IS NULL
            OR action ILIKE '%' || $3 || '%'
            OR COALESCE(target_type, '') ILIKE '%' || $3 || '%'
            OR COALESCE(target_id, '') ILIKE '%' || $3 || '%'
          )
        ORDER BY created_at DESC
        LIMIT $4 OFFSET $5
      `,
      [input.action, input.storeId, input.q, input.limit, input.offset],
    );

    const countResult = await this.databaseService.db.query<{ total: string }>(
      `
        SELECT COUNT(*)::text AS total
        FROM audit_logs
        WHERE ($1::text IS NULL OR action = $1)
          AND ($2::uuid IS NULL OR store_id = $2)
          AND (
            $3::text IS NULL
            OR action ILIKE '%' || $3 || '%'
            OR COALESCE(target_type, '') ILIKE '%' || $3 || '%'
            OR COALESCE(target_id, '') ILIKE '%' || $3 || '%'
          )
      `,
      [input.action, input.storeId, input.q],
    );

    return {
      rows: rowsResult.rows,
      total: Number(countResult.rows[0]?.total ?? '0'),
    };
  }

  async listPlatformQueueOverview(): Promise<
    Array<{ queue_name: string; backlog_count: number; failed_jobs: number; retry_ready: number }>
  > {
    const result = await this.databaseService.db.query<{
      queue_name: string;
      backlog_count: number;
      failed_jobs: number;
      retry_ready: number;
    }>(
      `
        SELECT
          'outbox_events'::text AS queue_name,
          COUNT(*) FILTER (WHERE status = 'pending')::int AS backlog_count,
          COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_jobs,
          COUNT(*) FILTER (
            WHERE status = 'failed'
              AND available_at <= NOW()
          )::int AS retry_ready
        FROM outbox_events
      `,
    );
    return result.rows;
  }
}

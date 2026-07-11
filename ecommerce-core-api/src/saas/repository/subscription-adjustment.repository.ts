import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../../database/database.service';
import type { Queryable, SubscriptionAdjustmentRecord } from './types';
import type {
  SubscriptionAccountingCategory,
  SubscriptionAdjustmentOperation,
} from '../constants/subscription-core.constants';

export interface SubscriptionAdjustmentListQuery {
  page?: number;
  limit?: number;
  operation?: SubscriptionAdjustmentOperation;
  accountingCategory?: SubscriptionAccountingCategory;
  from?: Date;
  to?: Date;
}

@Injectable()
export class SubscriptionAdjustmentRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async createAdjustment(
    input: {
      storeId: string;
      subscriptionId: string;
      invoiceId?: string | null;
      operation: SubscriptionAdjustmentOperation;
      accountingCategory: SubscriptionAccountingCategory;
      affectsRevenue: boolean;
      amount?: number | null;
      currencyCode?: string | null;
      daysDelta?: number | null;
      oldStatus?: string | null;
      newStatus?: string | null;
      oldBillingCycle?: string | null;
      newBillingCycle?: string | null;
      oldCurrentPeriodEnd?: Date | null;
      newCurrentPeriodEnd?: Date | null;
      oldNextBillingAt?: Date | null;
      newNextBillingAt?: Date | null;
      oldTrialEndsAt?: Date | null;
      newTrialEndsAt?: Date | null;
      reason: string;
      note?: string | null;
      createdByAdminId?: string | null;
      metadata?: Record<string, unknown>;
    },
    db?: Queryable,
  ): Promise<SubscriptionAdjustmentRecord> {
    const queryable = db ?? this.databaseService.db;
    const result = await queryable.query<SubscriptionAdjustmentRecord>(
      `
        INSERT INTO subscription_adjustments (
          id,
          store_id,
          subscription_id,
          invoice_id,
          operation,
          accounting_category,
          affects_revenue,
          amount,
          currency_code,
          days_delta,
          old_status,
          new_status,
          old_billing_cycle,
          new_billing_cycle,
          old_current_period_end,
          new_current_period_end,
          old_next_billing_at,
          new_next_billing_at,
          old_trial_ends_at,
          new_trial_ends_at,
          reason,
          note,
          created_by_admin_id,
          metadata
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
          $21, $22, $23, $24::jsonb
        )
        RETURNING
          id,
          store_id,
          subscription_id,
          invoice_id,
          operation,
          accounting_category,
          affects_revenue,
          amount,
          currency_code,
          days_delta,
          old_status,
          new_status,
          old_billing_cycle,
          new_billing_cycle,
          old_current_period_end,
          new_current_period_end,
          old_next_billing_at,
          new_next_billing_at,
          old_trial_ends_at,
          new_trial_ends_at,
          reason,
          note,
          created_by_admin_id,
          metadata,
          created_at
      `,
      [
        uuidv4(),
        input.storeId,
        input.subscriptionId,
        input.invoiceId ?? null,
        input.operation,
        input.accountingCategory,
        input.affectsRevenue,
        input.amount ?? null,
        input.currencyCode ?? null,
        input.daysDelta ?? null,
        input.oldStatus ?? null,
        input.newStatus ?? null,
        input.oldBillingCycle ?? null,
        input.newBillingCycle ?? null,
        input.oldCurrentPeriodEnd ?? null,
        input.newCurrentPeriodEnd ?? null,
        input.oldNextBillingAt ?? null,
        input.newNextBillingAt ?? null,
        input.oldTrialEndsAt ?? null,
        input.newTrialEndsAt ?? null,
        input.reason,
        input.note ?? null,
        input.createdByAdminId ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
    return result.rows[0] as SubscriptionAdjustmentRecord;
  }

  async listAdjustmentsByStore(
    storeId: string,
    query: SubscriptionAdjustmentListQuery,
  ): Promise<{
    items: SubscriptionAdjustmentRecord[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.listAdjustments('store_id', storeId, query);
  }

  async listAdjustmentsBySubscription(
    subscriptionId: string,
    query: SubscriptionAdjustmentListQuery,
  ): Promise<{
    items: SubscriptionAdjustmentRecord[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.listAdjustments('subscription_id', subscriptionId, query);
  }

  async getAdjustmentById(id: string): Promise<SubscriptionAdjustmentRecord | null> {
    const result = await this.databaseService.db.query<SubscriptionAdjustmentRecord>(
      `
        SELECT *
        FROM subscription_adjustments
        WHERE id = $1
        LIMIT 1
      `,
      [id],
    );
    return result.rows[0] ?? null;
  }

  private async listAdjustments(
    scopeColumn: 'store_id' | 'subscription_id',
    scopeId: string,
    query: SubscriptionAdjustmentListQuery,
  ): Promise<{
    items: SubscriptionAdjustmentRecord[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 25));
    const values: unknown[] = [scopeId];
    const filters = [`${scopeColumn} = $1`];

    if (query.operation) {
      values.push(query.operation);
      filters.push(`operation = $${values.length}`);
    }
    if (query.accountingCategory) {
      values.push(query.accountingCategory);
      filters.push(`accounting_category = $${values.length}`);
    }
    if (query.from) {
      values.push(query.from);
      filters.push(`created_at >= $${values.length}`);
    }
    if (query.to) {
      values.push(query.to);
      filters.push(`created_at <= $${values.length}`);
    }

    const whereSql = filters.join(' AND ');
    const countResult = await this.databaseService.db.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM subscription_adjustments WHERE ${whereSql}`,
      values,
    );

    values.push(limit, (page - 1) * limit);
    const result = await this.databaseService.db.query<SubscriptionAdjustmentRecord>(
      `
        SELECT *
        FROM subscription_adjustments
        WHERE ${whereSql}
        ORDER BY created_at DESC
        LIMIT $${values.length - 1}
        OFFSET $${values.length}
      `,
      values,
    );

    return {
      items: result.rows,
      total: Number(countResult.rows[0]?.total ?? 0),
      page,
      limit,
    };
  }
}

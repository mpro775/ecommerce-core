import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../../database/database.service';
import type { LimitResetPeriod } from '../constants/saas-metrics.constants';
import type { Queryable, PlanRecord, PlanLimitRecord, PlanEntitlementRecord } from './types';

@Injectable()
export class PlanRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async listPlans(options?: { onlyActive?: boolean }): Promise<PlanRecord[]> {
    const result = await this.databaseService.db.query<PlanRecord>(
      `
        SELECT
          id,
          code,
          name,
          description,
          is_active,
          monthly_price,
          annual_price,
          monthly_compare_at_price,
          annual_compare_at_price,
          currency_code,
          billing_cycle_options,
          trial_days_default,
          sale_label,
          sale_starts_at,
          sale_ends_at,
          is_intro_offer,
          is_sale_active,
          metadata
        FROM plans
        WHERE ($1::boolean = FALSE OR is_active = TRUE)
        ORDER BY created_at ASC
      `,
      [Boolean(options?.onlyActive)],
    );
    return result.rows;
  }

  async findPlanByCode(code: string): Promise<PlanRecord | null> {
    const result = await this.databaseService.db.query<PlanRecord>(
      `
        SELECT
          id,
          code,
          name,
          description,
          is_active,
          monthly_price,
          annual_price,
          monthly_compare_at_price,
          annual_compare_at_price,
          currency_code,
          billing_cycle_options,
          trial_days_default,
          sale_label,
          sale_starts_at,
          sale_ends_at,
          is_intro_offer,
          is_sale_active,
          metadata
        FROM plans
        WHERE LOWER(code) = LOWER($1)
        LIMIT 1
      `,
      [code],
    );
    return result.rows[0] ?? null;
  }

  async findPlanById(planId: string): Promise<PlanRecord | null> {
    const result = await this.databaseService.db.query<PlanRecord>(
      `
        SELECT
          id,
          code,
          name,
          description,
          is_active,
          monthly_price,
          annual_price,
          monthly_compare_at_price,
          annual_compare_at_price,
          currency_code,
          billing_cycle_options,
          trial_days_default,
          sale_label,
          sale_starts_at,
          sale_ends_at,
          is_intro_offer,
          is_sale_active,
          metadata
        FROM plans
        WHERE id = $1
        LIMIT 1
      `,
      [planId],
    );
    return result.rows[0] ?? null;
  }

  async createPlan(
    input: {
      code: string;
      name: string;
      description: string | null;
      isActive: boolean;
      monthlyPrice: number | null;
      annualPrice: number | null;
      monthlyCompareAtPrice: number | null;
      annualCompareAtPrice: number | null;
      currencyCode: string;
      billingCycleOptions: string[];
      trialDaysDefault: number;
      saleLabel: string | null;
      saleStartsAt: Date | null;
      saleEndsAt: Date | null;
      isIntroOffer: boolean;
      isSaleActive: boolean;
      metadata: Record<string, unknown>;
    },
    db?: Queryable,
  ): Promise<PlanRecord> {
    const queryable = db ?? this.databaseService.db;
    const result = await queryable.query<PlanRecord>(
      `
        INSERT INTO plans (
          id,
          code,
          name,
          description,
          is_active,
          monthly_price,
          annual_price,
          monthly_compare_at_price,
          annual_compare_at_price,
          currency_code,
          billing_cycle_options,
          trial_days_default,
          sale_label,
          sale_starts_at,
          sale_ends_at,
          is_intro_offer,
          is_sale_active,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::text[], $12, $13, $14, $15, $16, $17::jsonb)
        RETURNING
          id,
          code,
          name,
          description,
          is_active,
          monthly_price,
          annual_price,
          monthly_compare_at_price,
          annual_compare_at_price,
          currency_code,
          billing_cycle_options,
          trial_days_default,
          sale_label,
          sale_starts_at,
          sale_ends_at,
          is_intro_offer,
          is_sale_active,
          metadata
      `,
      [
        uuidv4(),
        input.code,
        input.name,
        input.description,
        input.isActive,
        input.monthlyPrice,
        input.annualPrice,
        input.monthlyCompareAtPrice,
        input.annualCompareAtPrice,
        input.currencyCode,
        input.billingCycleOptions,
        input.trialDaysDefault,
        input.saleLabel,
        input.saleStartsAt,
        input.saleEndsAt,
        input.isIntroOffer,
        input.isSaleActive,
        JSON.stringify(input.metadata),
      ],
    );
    return result.rows[0] as PlanRecord;
  }

  async updatePlan(
    input: {
      planId: string;
      name: string;
      description: string | null;
      isActive: boolean;
      monthlyPrice: number | null;
      annualPrice: number | null;
      monthlyCompareAtPrice: number | null;
      annualCompareAtPrice: number | null;
      currencyCode: string;
      billingCycleOptions: string[];
      trialDaysDefault: number;
      saleLabel: string | null;
      saleStartsAt: Date | null;
      saleEndsAt: Date | null;
      isIntroOffer: boolean;
      isSaleActive: boolean;
      metadata: Record<string, unknown>;
    },
    db?: Queryable,
  ): Promise<PlanRecord | null> {
    const queryable = db ?? this.databaseService.db;
    const result = await queryable.query<PlanRecord>(
      `
        UPDATE plans
        SET name = $2,
            description = $3,
            is_active = $4,
            monthly_price = $5,
            annual_price = $6,
            monthly_compare_at_price = $7,
            annual_compare_at_price = $8,
            currency_code = $9,
            billing_cycle_options = $10::text[],
            trial_days_default = $11,
            sale_label = $12,
            sale_starts_at = $13,
            sale_ends_at = $14,
            is_intro_offer = $15,
            is_sale_active = $16,
            metadata = $17::jsonb,
            updated_at = NOW()
        WHERE id = $1
        RETURNING
          id,
          code,
          name,
          description,
          is_active,
          monthly_price,
          annual_price,
          monthly_compare_at_price,
          annual_compare_at_price,
          currency_code,
          billing_cycle_options,
          trial_days_default,
          sale_label,
          sale_starts_at,
          sale_ends_at,
          is_intro_offer,
          is_sale_active,
          metadata
      `,
      [
        input.planId,
        input.name,
        input.description,
        input.isActive,
        input.monthlyPrice,
        input.annualPrice,
        input.monthlyCompareAtPrice,
        input.annualCompareAtPrice,
        input.currencyCode,
        input.billingCycleOptions,
        input.trialDaysDefault,
        input.saleLabel,
        input.saleStartsAt,
        input.saleEndsAt,
        input.isIntroOffer,
        input.isSaleActive,
        JSON.stringify(input.metadata),
      ],
    );
    return result.rows[0] ?? null;
  }

  async setPlanActive(planId: string, isActive: boolean): Promise<PlanRecord | null> {
    const result = await this.databaseService.db.query<PlanRecord>(
      `
        UPDATE plans
        SET is_active = $2,
            updated_at = NOW()
        WHERE id = $1
        RETURNING
          id,
          code,
          name,
          description,
          is_active,
          monthly_price,
          annual_price,
          monthly_compare_at_price,
          annual_compare_at_price,
          currency_code,
          billing_cycle_options,
          trial_days_default,
          sale_label,
          sale_starts_at,
          sale_ends_at,
          is_intro_offer,
          is_sale_active,
          metadata
      `,
      [planId, isActive],
    );

    return result.rows[0] ?? null;
  }

  async listPlanLimits(planId: string): Promise<PlanLimitRecord[]> {
    const result = await this.databaseService.db.query<PlanLimitRecord>(
      `
        SELECT id, plan_id, metric_key, metric_limit, reset_period
        FROM plan_limits
        WHERE plan_id = $1
        ORDER BY metric_key ASC
      `,
      [planId],
    );
    return result.rows;
  }

  async replacePlanLimits(
    db: Queryable,
    planId: string,
    limits: Array<{ metricKey: string; metricLimit: number | null; resetPeriod: LimitResetPeriod }>,
  ): Promise<void> {
    await db.query(
      `
        DELETE FROM plan_limits
        WHERE plan_id = $1
      `,
      [planId],
    );

    for (const limit of limits) {
      await db.query(
        `
          INSERT INTO plan_limits (id, plan_id, metric_key, metric_limit, reset_period)
          VALUES ($1, $2, $3, $4, $5)
        `,
        [uuidv4(), planId, limit.metricKey, limit.metricLimit, limit.resetPeriod],
      );
    }
  }

  async listPlanEntitlements(planId: string): Promise<PlanEntitlementRecord[]> {
    const result = await this.databaseService.db.query<PlanEntitlementRecord>(
      `
        SELECT id, plan_id, feature_key, is_enabled
        FROM plan_entitlements
        WHERE plan_id = $1
        ORDER BY feature_key ASC
      `,
      [planId],
    );
    return result.rows;
  }

  async replacePlanEntitlements(
    db: Queryable,
    planId: string,
    entitlements: Array<{ featureKey: string; isEnabled: boolean }>,
  ): Promise<void> {
    await db.query(
      `
        DELETE FROM plan_entitlements
        WHERE plan_id = $1
      `,
      [planId],
    );

    for (const entitlement of entitlements) {
      await db.query(
        `
          INSERT INTO plan_entitlements (id, plan_id, feature_key, is_enabled)
          VALUES ($1, $2, $3, $4)
        `,
        [uuidv4(), planId, entitlement.featureKey, entitlement.isEnabled],
      );
    }
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

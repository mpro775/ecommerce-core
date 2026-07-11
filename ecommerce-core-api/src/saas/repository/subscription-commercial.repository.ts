import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../../database/database.service';
import type {
  Queryable,
  SubscriptionCouponRecord,
  SubscriptionCouponRedemptionRecord,
  SubscriptionSettingsRecord,
} from './types';

@Injectable()
export class SubscriptionCommercialRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async getSettings(): Promise<SubscriptionSettingsRecord> {
    await this.databaseService.db.query(
      `
        INSERT INTO subscription_settings (singleton_key)
        VALUES ('default')
        ON CONFLICT (singleton_key) DO NOTHING
      `,
    );

    const result = await this.databaseService.db.query<SubscriptionSettingsRecord>(
      `
        SELECT
          id,
          signup_trial_enabled,
          signup_trial_plan_code,
          signup_trial_days,
          after_trial_behavior,
          free_plan_code,
          allow_trial_plan_change,
          one_trial_per_store,
          one_trial_per_owner,
          trial_requires_payment_method,
          trial_reminder_days_before,
          created_at,
          updated_at
        FROM subscription_settings
        WHERE singleton_key = 'default'
        LIMIT 1
      `,
    );
    return result.rows[0] as SubscriptionSettingsRecord;
  }

  async updateSettings(input: {
    signupTrialEnabled: boolean;
    signupTrialPlanCode: string | null;
    signupTrialDays: number;
    afterTrialBehavior: string;
    freePlanCode: string | null;
    allowTrialPlanChange: boolean;
    oneTrialPerStore: boolean;
    oneTrialPerOwner: boolean;
    trialRequiresPaymentMethod: boolean;
    trialReminderDaysBefore: number[];
  }): Promise<SubscriptionSettingsRecord> {
    const result = await this.databaseService.db.query<SubscriptionSettingsRecord>(
      `
        UPDATE subscription_settings
        SET signup_trial_enabled = $1,
            signup_trial_plan_code = $2,
            signup_trial_days = $3,
            after_trial_behavior = $4,
            free_plan_code = $5,
            allow_trial_plan_change = $6,
            one_trial_per_store = $7,
            one_trial_per_owner = $8,
            trial_requires_payment_method = $9,
            trial_reminder_days_before = $10::integer[],
            updated_at = NOW()
        WHERE singleton_key = 'default'
        RETURNING
          id,
          signup_trial_enabled,
          signup_trial_plan_code,
          signup_trial_days,
          after_trial_behavior,
          free_plan_code,
          allow_trial_plan_change,
          one_trial_per_store,
          one_trial_per_owner,
          trial_requires_payment_method,
          trial_reminder_days_before,
          created_at,
          updated_at
      `,
      [
        input.signupTrialEnabled,
        input.signupTrialPlanCode,
        input.signupTrialDays,
        input.afterTrialBehavior,
        input.freePlanCode,
        input.allowTrialPlanChange,
        input.oneTrialPerStore,
        input.oneTrialPerOwner,
        input.trialRequiresPaymentMethod,
        input.trialReminderDaysBefore,
      ],
    );
    return result.rows[0] as SubscriptionSettingsRecord;
  }

  async hasStoreUsedTrial(storeId: string): Promise<boolean> {
    const result = await this.databaseService.db.query<{ used: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM store_subscriptions
          WHERE store_id = $1
            AND status = 'trialing'
        ) AS used
      `,
      [storeId],
    );
    return Boolean(result.rows[0]?.used);
  }

  async hasOwnerUsedTrial(ownerId: string): Promise<boolean> {
    const result = await this.databaseService.db.query<{ used: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM store_users su
          INNER JOIN store_subscriptions ss
            ON ss.store_id = su.store_id
          WHERE su.id = $1
            AND ss.status = 'trialing'
        ) AS used
      `,
      [ownerId],
    );
    return Boolean(result.rows[0]?.used);
  }

  async listExpiredTrials(limit: number): Promise<Array<{ store_id: string }>> {
    const result = await this.databaseService.db.query<{ store_id: string }>(
      `
        SELECT store_id
        FROM store_subscriptions
        WHERE is_current = TRUE
          AND status = 'trialing'
          AND trial_ends_at IS NOT NULL
          AND trial_ends_at <= NOW()
        ORDER BY trial_ends_at ASC
        LIMIT $1
      `,
      [limit],
    );
    return result.rows;
  }

  async listCoupons(): Promise<SubscriptionCouponRecord[]> {
    const result = await this.databaseService.db.query<SubscriptionCouponRecord>(
      `
        SELECT *
        FROM subscription_coupons
        ORDER BY created_at DESC
      `,
    );
    return result.rows;
  }

  async findCouponById(couponId: string): Promise<SubscriptionCouponRecord | null> {
    const result = await this.databaseService.db.query<SubscriptionCouponRecord>(
      `
        SELECT *
        FROM subscription_coupons
        WHERE id = $1
        LIMIT 1
      `,
      [couponId],
    );
    return result.rows[0] ?? null;
  }

  async findCouponByCode(code: string): Promise<SubscriptionCouponRecord | null> {
    const result = await this.databaseService.db.query<SubscriptionCouponRecord>(
      `
        SELECT *
        FROM subscription_coupons
        WHERE LOWER(code) = LOWER($1)
        LIMIT 1
      `,
      [code],
    );
    return result.rows[0] ?? null;
  }

  async createCoupon(input: {
    code: string;
    name: string;
    description: string | null;
    discountType: string;
    discountValue: number;
    currencyCode: string;
    durationMonths: number;
    appliesToPlanCodes: string[];
    purpose: string;
    accountingCategory: string;
    affectsRevenue: boolean;
    activatePlanCode: string | null;
    maxRedemptions: number | null;
    maxRedemptionsPerStore: number | null;
    startsAt: Date | null;
    expiresAt: Date | null;
    isActive: boolean;
    metadata: Record<string, unknown>;
  }): Promise<SubscriptionCouponRecord> {
    const result = await this.databaseService.db.query<SubscriptionCouponRecord>(
      `
        INSERT INTO subscription_coupons (
          id,
          code,
          name,
          description,
          discount_type,
          discount_value,
          currency_code,
          duration_months,
          applies_to_plan_codes,
          purpose,
          accounting_category,
          affects_revenue,
          activate_plan_code,
          max_redemptions,
          max_redemptions_per_store,
          starts_at,
          expires_at,
          is_active,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::text[], $10, $11, $12, $13, $14, $15, $16, $17, $18::jsonb)
        RETURNING *
      `,
      [
        uuidv4(),
        input.code,
        input.name,
        input.description,
        input.discountType,
        input.discountValue,
        input.currencyCode,
        input.durationMonths,
        input.appliesToPlanCodes,
        input.purpose,
        input.accountingCategory,
        input.affectsRevenue,
        input.activatePlanCode,
        input.maxRedemptions,
        input.maxRedemptionsPerStore,
        input.startsAt,
        input.expiresAt,
        input.isActive,
        JSON.stringify(input.metadata),
      ],
    );
    return result.rows[0] as SubscriptionCouponRecord;
  }

  async updateCoupon(
    couponId: string,
    input: {
      name: string;
      description: string | null;
      discountType: string;
      discountValue: number;
      currencyCode: string;
      durationMonths: number;
      appliesToPlanCodes: string[];
      purpose: string;
      accountingCategory: string;
      affectsRevenue: boolean;
      activatePlanCode: string | null;
      maxRedemptions: number | null;
      maxRedemptionsPerStore: number | null;
      startsAt: Date | null;
      expiresAt: Date | null;
      isActive: boolean;
      metadata: Record<string, unknown>;
    },
  ): Promise<SubscriptionCouponRecord | null> {
    const result = await this.databaseService.db.query<SubscriptionCouponRecord>(
      `
        UPDATE subscription_coupons
        SET name = $2,
            description = $3,
            discount_type = $4,
            discount_value = $5,
            currency_code = $6,
            duration_months = $7,
            applies_to_plan_codes = $8::text[],
            purpose = $9,
            accounting_category = $10,
            affects_revenue = $11,
            activate_plan_code = $12,
            max_redemptions = $13,
            max_redemptions_per_store = $14,
            starts_at = $15,
            expires_at = $16,
            is_active = $17,
            metadata = $18::jsonb,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [
        couponId,
        input.name,
        input.description,
        input.discountType,
        input.discountValue,
        input.currencyCode,
        input.durationMonths,
        input.appliesToPlanCodes,
        input.purpose,
        input.accountingCategory,
        input.affectsRevenue,
        input.activatePlanCode,
        input.maxRedemptions,
        input.maxRedemptionsPerStore,
        input.startsAt,
        input.expiresAt,
        input.isActive,
        JSON.stringify(input.metadata),
      ],
    );
    return result.rows[0] ?? null;
  }

  async countCouponRedemptionsForStore(couponId: string, storeId: string): Promise<number> {
    const result = await this.databaseService.db.query<{ total: string }>(
      `
        SELECT COUNT(*)::text AS total
        FROM subscription_coupon_redemptions
        WHERE coupon_id = $1
          AND store_id = $2
      `,
      [couponId, storeId],
    );
    return Number(result.rows[0]?.total ?? '0');
  }

  async createCouponRedemption(
    db: Queryable,
    input: {
      couponId: string;
      storeId: string;
      subscriptionId: string | null;
      planId: string | null;
      invoiceId: string | null;
      couponCode: string;
      discountType: string;
      discountValue: number;
      billingCycle: string;
      originalAmount: number;
      discountAmount: number;
      finalAmount: number;
      freeMonths: number;
      metadata: Record<string, unknown>;
    },
  ): Promise<SubscriptionCouponRedemptionRecord> {
    const result = await db.query<SubscriptionCouponRedemptionRecord>(
      `
        INSERT INTO subscription_coupon_redemptions (
          id,
          coupon_id,
          store_id,
          subscription_id,
          plan_id,
          invoice_id,
          coupon_code,
          discount_type,
          discount_value,
          billing_cycle,
          original_amount,
          discount_amount,
          final_amount,
          free_months,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb)
        RETURNING *
      `,
      [
        uuidv4(),
        input.couponId,
        input.storeId,
        input.subscriptionId,
        input.planId,
        input.invoiceId,
        input.couponCode,
        input.discountType,
        input.discountValue,
        input.billingCycle,
        input.originalAmount,
        input.discountAmount,
        input.finalAmount,
        input.freeMonths,
        JSON.stringify(input.metadata),
      ],
    );

    await db.query(
      `
        UPDATE subscription_coupons
        SET redeemed_count = redeemed_count + 1,
            updated_at = NOW()
        WHERE id = $1
      `,
      [input.couponId],
    );

    return result.rows[0] as SubscriptionCouponRedemptionRecord;
  }

  async listCouponRedemptions(couponId: string): Promise<SubscriptionCouponRedemptionRecord[]> {
    const result = await this.databaseService.db.query<SubscriptionCouponRedemptionRecord>(
      `
        SELECT *
        FROM subscription_coupon_redemptions
        WHERE coupon_id = $1
        ORDER BY redeemed_at DESC
      `,
      [couponId],
    );
    return result.rows;
  }

  async listCouponRedemptionsByStore(
    storeId: string,
    limit = 25,
  ): Promise<SubscriptionCouponRedemptionRecord[]> {
    const result = await this.databaseService.db.query<SubscriptionCouponRedemptionRecord>(
      `
        SELECT *
        FROM subscription_coupon_redemptions
        WHERE store_id = $1
        ORDER BY redeemed_at DESC
        LIMIT $2
      `,
      [storeId, limit],
    );
    return result.rows;
  }

  async getSubscriptionAnalytics(): Promise<{
    actual_mrr: string;
    trial_pipeline_mrr: string;
    trial_stores_count: string;
    trial_conversion_rate: string;
    expiring_trials_7_days: string;
    expired_not_converted: string;
    coupon_mrr_impact: string;
  }> {
    const result = await this.databaseService.db.query<{
      actual_mrr: string;
      trial_pipeline_mrr: string;
      trial_stores_count: string;
      trial_conversion_rate: string;
      expiring_trials_7_days: string;
      expired_not_converted: string;
      coupon_mrr_impact: string;
    }>(
      `
        WITH current_subs AS (
          SELECT ss.*, p.monthly_price
          FROM store_subscriptions ss
          INNER JOIN plans p ON p.id = ss.plan_id
          WHERE ss.is_current = TRUE
        ),
        converted AS (
          SELECT store_id
          FROM store_subscriptions
          GROUP BY store_id
          HAVING BOOL_OR(status = 'trialing') AND BOOL_OR(status = 'active')
        )
        SELECT
          COALESCE(SUM(CASE WHEN status = 'active' THEN COALESCE(monthly_price, 0) ELSE 0 END), 0)::text AS actual_mrr,
          COALESCE(SUM(CASE WHEN status = 'trialing' THEN COALESCE(monthly_price, 0) ELSE 0 END), 0)::text AS trial_pipeline_mrr,
          COUNT(*) FILTER (WHERE status = 'trialing')::text AS trial_stores_count,
          CASE
            WHEN (SELECT COUNT(DISTINCT store_id) FROM store_subscriptions WHERE status = 'trialing') = 0 THEN '0'
            ELSE ROUND(
              ((SELECT COUNT(*) FROM converted)::numeric /
              NULLIF((SELECT COUNT(DISTINCT store_id) FROM store_subscriptions WHERE status = 'trialing'), 0)) * 100,
              2
            )::text
          END AS trial_conversion_rate,
          COUNT(*) FILTER (
            WHERE status = 'trialing'
              AND trial_ends_at IS NOT NULL
              AND trial_ends_at <= NOW() + INTERVAL '7 days'
              AND trial_ends_at > NOW()
          )::text AS expiring_trials_7_days,
          COUNT(*) FILTER (
            WHERE status IN ('trialing', 'past_due')
              AND trial_ends_at IS NOT NULL
              AND trial_ends_at <= NOW()
          )::text AS expired_not_converted,
          COALESCE((SELECT SUM(discount_amount) FROM subscription_coupon_redemptions), 0)::text AS coupon_mrr_impact
        FROM current_subs
      `,
    );
    return result.rows[0] as {
      actual_mrr: string;
      trial_pipeline_mrr: string;
      trial_stores_count: string;
      trial_conversion_rate: string;
      expiring_trials_7_days: string;
      expired_not_converted: string;
      coupon_mrr_impact: string;
    };
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

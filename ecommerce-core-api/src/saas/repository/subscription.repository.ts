import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../../database/database.service';
import type { Queryable, CurrentSubscriptionRecord } from './types';
import type {
  SubscriptionBillingCycle,
  SubscriptionStatus,
} from '../constants/subscription-core.constants';

@Injectable()
export class SubscriptionRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async getCurrentSubscription(storeId: string): Promise<CurrentSubscriptionRecord | null> {
    const result = await this.databaseService.db.query<CurrentSubscriptionRecord>(
      `
        SELECT
          ss.id,
          ss.store_id,
          ss.plan_id,
          ss.status,
          ss.starts_at,
          ss.current_period_end,
          ss.trial_ends_at,
          ss.billing_cycle,
          ss.cancel_at_period_end,
          ss.canceled_at,
          ss.next_billing_at,
          ss.provider_customer_id,
          ss.provider_subscription_id,
          p.code AS plan_code,
          p.name AS plan_name,
          p.description AS plan_description,
          p.is_active AS plan_is_active,
          p.monthly_price AS plan_monthly_price,
          p.annual_price AS plan_annual_price,
          p.monthly_compare_at_price AS plan_monthly_compare_at_price,
          p.annual_compare_at_price AS plan_annual_compare_at_price,
          p.currency_code AS plan_currency_code,
          p.sale_label AS plan_sale_label,
          p.sale_starts_at AS plan_sale_starts_at,
          p.sale_ends_at AS plan_sale_ends_at,
          p.is_intro_offer AS plan_is_intro_offer,
          p.is_sale_active AS plan_is_sale_active
        FROM store_subscriptions ss
        INNER JOIN plans p
          ON p.id = ss.plan_id
        WHERE ss.store_id = $1
          AND ss.is_current = TRUE
        LIMIT 1
      `,
      [storeId],
    );
    return result.rows[0] ?? null;
  }

  async getCurrentSubscriptionForUpdate(
    storeId: string,
    db: Queryable,
  ): Promise<CurrentSubscriptionRecord | null> {
    const result = await db.query<CurrentSubscriptionRecord>(
      `
        SELECT
          ss.id,
          ss.store_id,
          ss.plan_id,
          ss.status,
          ss.starts_at,
          ss.current_period_end,
          ss.trial_ends_at,
          ss.billing_cycle,
          ss.cancel_at_period_end,
          ss.canceled_at,
          ss.next_billing_at,
          ss.provider_customer_id,
          ss.provider_subscription_id,
          p.code AS plan_code,
          p.name AS plan_name,
          p.description AS plan_description,
          p.is_active AS plan_is_active,
          p.monthly_price AS plan_monthly_price,
          p.annual_price AS plan_annual_price,
          p.monthly_compare_at_price AS plan_monthly_compare_at_price,
          p.annual_compare_at_price AS plan_annual_compare_at_price,
          p.currency_code AS plan_currency_code,
          p.sale_label AS plan_sale_label,
          p.sale_starts_at AS plan_sale_starts_at,
          p.sale_ends_at AS plan_sale_ends_at,
          p.is_intro_offer AS plan_is_intro_offer,
          p.is_sale_active AS plan_is_sale_active
        FROM store_subscriptions ss
        INNER JOIN plans p
          ON p.id = ss.plan_id
        WHERE ss.store_id = $1
          AND ss.is_current = TRUE
        LIMIT 1
        FOR UPDATE OF ss
      `,
      [storeId],
    );
    return result.rows[0] ?? null;
  }

  async replaceCurrentSubscription(
    input: {
      storeId: string;
      planId: string;
      status: SubscriptionStatus;
      startsAt: Date;
      currentPeriodEnd: Date | null;
      trialEndsAt: Date | null;
      billingCycle: SubscriptionBillingCycle;
      nextBillingAt: Date | null;
      cancelAtPeriodEnd?: boolean;
      canceledAt?: Date | null;
      providerCustomerId?: string | null;
      providerSubscriptionId?: string | null;
    },
    db?: Queryable,
  ): Promise<void> {
    const apply = async (queryable: Queryable): Promise<void> => {
      await queryable.query(
        `
          UPDATE store_subscriptions
          SET is_current = FALSE,
              updated_at = NOW()
          WHERE store_id = $1
            AND is_current = TRUE
        `,
        [input.storeId],
      );

      await queryable.query(
        `
          INSERT INTO store_subscriptions (
            id,
            store_id,
            plan_id,
            status,
            starts_at,
            current_period_end,
            trial_ends_at,
            billing_cycle,
            cancel_at_period_end,
            canceled_at,
            next_billing_at,
            provider_customer_id,
            provider_subscription_id,
            is_current
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, TRUE)
        `,
        [
          uuidv4(),
          input.storeId,
          input.planId,
          input.status,
          input.startsAt,
          input.currentPeriodEnd,
          input.trialEndsAt,
          input.billingCycle,
          input.cancelAtPeriodEnd ?? false,
          input.canceledAt ?? null,
          input.nextBillingAt,
          input.providerCustomerId ?? null,
          input.providerSubscriptionId ?? null,
        ],
      );
    };

    if (db) {
      await apply(db);
      return;
    }

    await this.withTransaction(apply);
  }

  async updateCurrentSubscriptionBilling(
    input: {
      storeId: string;
      billingCycle?: SubscriptionBillingCycle;
      currentPeriodEnd?: Date | null;
      trialEndsAt?: Date | null;
      nextBillingAt?: Date | null;
      cancelAtPeriodEnd?: boolean;
      canceledAt?: Date | null;
      providerCustomerId?: string | null;
      providerSubscriptionId?: string | null;
    },
    db?: Queryable,
  ): Promise<boolean> {
    const queryable = db ?? this.databaseService.db;
    const assignments: string[] = ['updated_at = NOW()'];
    const values: unknown[] = [input.storeId];

    const append = (column: string, value: unknown) => {
      values.push(value);
      assignments.push(`${column} = $${values.length}`);
    };

    if (input.billingCycle !== undefined) {
      append('billing_cycle', input.billingCycle);
    }
    if (input.currentPeriodEnd !== undefined) {
      append('current_period_end', input.currentPeriodEnd);
    }
    if (input.trialEndsAt !== undefined) {
      append('trial_ends_at', input.trialEndsAt);
    }
    if (input.nextBillingAt !== undefined) {
      append('next_billing_at', input.nextBillingAt);
    }
    if (input.cancelAtPeriodEnd !== undefined) {
      append('cancel_at_period_end', input.cancelAtPeriodEnd);
    }
    if (input.canceledAt !== undefined) {
      append('canceled_at', input.canceledAt);
    }
    if (input.providerCustomerId !== undefined) {
      append('provider_customer_id', input.providerCustomerId);
    }
    if (input.providerSubscriptionId !== undefined) {
      append('provider_subscription_id', input.providerSubscriptionId);
    }

    const result = await queryable.query(
      `
        UPDATE store_subscriptions
        SET ${assignments.join(', ')}
        WHERE store_id = $1
          AND is_current = TRUE
      `,
      values,
    );

    return (result.rowCount ?? 0) > 0;
  }

  async findSubscriptionById(subscriptionId: string): Promise<CurrentSubscriptionRecord | null> {
    const result = await this.databaseService.db.query<CurrentSubscriptionRecord>(
      `
        SELECT
          ss.id,
          ss.store_id,
          ss.plan_id,
          ss.status,
          ss.starts_at,
          ss.current_period_end,
          ss.trial_ends_at,
          ss.billing_cycle,
          ss.cancel_at_period_end,
          ss.canceled_at,
          ss.next_billing_at,
          ss.provider_customer_id,
          ss.provider_subscription_id,
          p.code AS plan_code,
          p.name AS plan_name,
          p.description AS plan_description,
          p.is_active AS plan_is_active,
          p.monthly_price AS plan_monthly_price,
          p.annual_price AS plan_annual_price,
          p.monthly_compare_at_price AS plan_monthly_compare_at_price,
          p.annual_compare_at_price AS plan_annual_compare_at_price,
          p.currency_code AS plan_currency_code,
          p.sale_label AS plan_sale_label,
          p.sale_starts_at AS plan_sale_starts_at,
          p.sale_ends_at AS plan_sale_ends_at,
          p.is_intro_offer AS plan_is_intro_offer,
          p.is_sale_active AS plan_is_sale_active
        FROM store_subscriptions ss
        INNER JOIN plans p ON p.id = ss.plan_id
        WHERE ss.id = $1
        LIMIT 1
      `,
      [subscriptionId],
    );
    return result.rows[0] ?? null;
  }

  async findCurrentSubscriptionByProviderSubscriptionId(
    providerSubscriptionId: string,
  ): Promise<CurrentSubscriptionRecord | null> {
    const result = await this.databaseService.db.query<CurrentSubscriptionRecord>(
      `
        SELECT
          ss.id,
          ss.store_id,
          ss.plan_id,
          ss.status,
          ss.starts_at,
          ss.current_period_end,
          ss.trial_ends_at,
          ss.billing_cycle,
          ss.cancel_at_period_end,
          ss.canceled_at,
          ss.next_billing_at,
          ss.provider_customer_id,
          ss.provider_subscription_id,
          p.code AS plan_code,
          p.name AS plan_name,
          p.description AS plan_description,
          p.is_active AS plan_is_active,
          p.monthly_price AS plan_monthly_price,
          p.annual_price AS plan_annual_price,
          p.monthly_compare_at_price AS plan_monthly_compare_at_price,
          p.annual_compare_at_price AS plan_annual_compare_at_price,
          p.currency_code AS plan_currency_code,
          p.sale_label AS plan_sale_label,
          p.sale_starts_at AS plan_sale_starts_at,
          p.sale_ends_at AS plan_sale_ends_at,
          p.is_intro_offer AS plan_is_intro_offer,
          p.is_sale_active AS plan_is_sale_active
        FROM store_subscriptions ss
        INNER JOIN plans p ON p.id = ss.plan_id
        WHERE ss.provider_subscription_id = $1
          AND ss.is_current = TRUE
        LIMIT 1
      `,
      [providerSubscriptionId],
    );
    return result.rows[0] ?? null;
  }

  async updateSubscriptionStatus(
    storeId: string,
    status: SubscriptionStatus,
    db?: Queryable,
  ): Promise<boolean> {
    const queryable = db ?? this.databaseService.db;
    const result = await queryable.query(
      `
        UPDATE store_subscriptions
        SET status = $2,
            updated_at = NOW()
        WHERE store_id = $1
          AND is_current = TRUE
      `,
      [storeId, status],
    );
    return (result.rowCount ?? 0) > 0;
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

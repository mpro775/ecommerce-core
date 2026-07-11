import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../../database/database.service';
import type {
  Queryable,
  SubscriptionInvoiceRecord,
  SubscriptionPaymentRecord,
  PlatformInvoiceDetailsRecord,
} from './types';
import type {
  InvoiceBillingCycle,
  SubscriptionInvoiceStatus,
  SubscriptionPaymentStatus,
} from '../constants/subscription-core.constants';

@Injectable()
export class InvoiceRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async createInvoice(
    input: {
      storeId: string;
      subscriptionId: string;
      planId: string;
      invoiceNumber: string;
      billingCycle: InvoiceBillingCycle;
      periodStart: Date;
      periodEnd: Date;
      subtotalAmount: number;
      taxAmount: number;
      totalAmount: number;
      currencyCode: string;
      status: SubscriptionInvoiceStatus;
      dueAt: Date | null;
      paidAt?: Date | null;
      externalInvoiceId?: string | null;
      metadata?: Record<string, unknown>;
    },
    db?: Queryable,
  ): Promise<SubscriptionInvoiceRecord> {
    const queryable = db ?? this.databaseService.db;
    const result = await queryable.query<SubscriptionInvoiceRecord>(
      `
        INSERT INTO subscription_invoices (
          id,
          store_id,
          subscription_id,
          plan_id,
          invoice_number,
          billing_cycle,
          period_start,
          period_end,
          subtotal_amount,
          tax_amount,
          total_amount,
          currency_code,
          status,
          due_at,
          paid_at,
          external_invoice_id,
          metadata,
          original_amount,
          discount_amount,
          coupon_code
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb,
          COALESCE(($17::jsonb ->> 'originalAmount')::numeric, $9),
          COALESCE(($17::jsonb ->> 'discountAmount')::numeric, 0),
          $17::jsonb ->> 'couponCode'
        )
        RETURNING
          id,
          store_id,
          subscription_id,
          plan_id,
          invoice_number,
          billing_cycle,
          period_start,
          period_end,
          subtotal_amount,
          tax_amount,
          total_amount,
          currency_code,
          status,
          due_at,
          paid_at,
          external_invoice_id,
          metadata,
          original_amount,
          discount_amount,
          coupon_code,
          created_at,
          updated_at
      `,
      [
        uuidv4(),
        input.storeId,
        input.subscriptionId,
        input.planId,
        input.invoiceNumber,
        input.billingCycle,
        input.periodStart,
        input.periodEnd,
        input.subtotalAmount,
        input.taxAmount,
        input.totalAmount,
        input.currencyCode,
        input.status,
        input.dueAt,
        input.paidAt ?? null,
        input.externalInvoiceId ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    );

    return result.rows[0] as SubscriptionInvoiceRecord;
  }

  async findInvoiceById(invoiceId: string): Promise<SubscriptionInvoiceRecord | null> {
    const result = await this.databaseService.db.query<SubscriptionInvoiceRecord>(
      `
        SELECT
          id,
          store_id,
          subscription_id,
          plan_id,
          invoice_number,
          billing_cycle,
          period_start,
          period_end,
          subtotal_amount,
          tax_amount,
          total_amount,
          currency_code,
          status,
          due_at,
          paid_at,
          external_invoice_id,
          metadata,
          original_amount,
          discount_amount,
          coupon_code,
          created_at,
          updated_at
        FROM subscription_invoices
        WHERE id = $1
        LIMIT 1
      `,
      [invoiceId],
    );
    return result.rows[0] ?? null;
  }

  async findInvoiceByExternalInvoiceId(
    externalInvoiceId: string,
  ): Promise<SubscriptionInvoiceRecord | null> {
    const result = await this.databaseService.db.query<SubscriptionInvoiceRecord>(
      `
        SELECT
          id,
          store_id,
          subscription_id,
          plan_id,
          invoice_number,
          billing_cycle,
          period_start,
          period_end,
          subtotal_amount,
          tax_amount,
          total_amount,
          currency_code,
          status,
          due_at,
          paid_at,
          external_invoice_id,
          metadata,
          original_amount,
          discount_amount,
          coupon_code,
          created_at,
          updated_at
        FROM subscription_invoices
        WHERE external_invoice_id = $1
        LIMIT 1
      `,
      [externalInvoiceId],
    );
    return result.rows[0] ?? null;
  }

  async updateInvoiceStatus(
    input: {
      invoiceId: string;
      status: SubscriptionInvoiceStatus;
      paidAt?: Date | null;
      externalInvoiceId?: string | null;
      metadata?: Record<string, unknown>;
    },
    db?: Queryable,
  ): Promise<boolean> {
    const queryable = db ?? this.databaseService.db;
    const result = await queryable.query(
      `
        UPDATE subscription_invoices
        SET status = $2,
            paid_at = $3,
            external_invoice_id = COALESCE($4, external_invoice_id),
            metadata = CASE WHEN $5::jsonb = '{}'::jsonb THEN metadata ELSE $5::jsonb END,
            updated_at = NOW()
        WHERE id = $1
      `,
      [
        input.invoiceId,
        input.status,
        input.paidAt ?? null,
        input.externalInvoiceId ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    );

    return (result.rowCount ?? 0) > 0;
  }

  async listInvoicesByStore(input: {
    storeId: string;
    status: string | null;
    limit: number;
    offset: number;
  }): Promise<{ rows: SubscriptionInvoiceRecord[]; total: number }> {
    const rowsResult = await this.databaseService.db.query<SubscriptionInvoiceRecord>(
      `
        SELECT
          id,
          store_id,
          subscription_id,
          plan_id,
          invoice_number,
          billing_cycle,
          period_start,
          period_end,
          subtotal_amount,
          tax_amount,
          total_amount,
          currency_code,
          status,
          due_at,
          paid_at,
          external_invoice_id,
          metadata,
          original_amount,
          discount_amount,
          coupon_code,
          created_at,
          updated_at
        FROM subscription_invoices
        WHERE store_id = $1
          AND ($2::text IS NULL OR status = $2)
        ORDER BY created_at DESC
        LIMIT $3 OFFSET $4
      `,
      [input.storeId, input.status, input.limit, input.offset],
    );

    const countResult = await this.databaseService.db.query<{ total: string }>(
      `
        SELECT COUNT(*)::text AS total
        FROM subscription_invoices
        WHERE store_id = $1
          AND ($2::text IS NULL OR status = $2)
      `,
      [input.storeId, input.status],
    );

    return {
      rows: rowsResult.rows,
      total: Number(countResult.rows[0]?.total ?? '0'),
    };
  }

  async createPayment(
    input: {
      invoiceId: string;
      storeId: string;
      provider: string;
      paymentMethod: string | null;
      status: SubscriptionPaymentStatus;
      amount: number;
      currencyCode: string;
      externalTransactionId?: string | null;
      failureReason?: string | null;
      processedAt?: Date | null;
      metadata?: Record<string, unknown>;
    },
    db?: Queryable,
  ): Promise<SubscriptionPaymentRecord> {
    const queryable = db ?? this.databaseService.db;
    const result = await queryable.query<SubscriptionPaymentRecord>(
      `
        INSERT INTO subscription_payments (
          id,
          invoice_id,
          store_id,
          provider,
          payment_method,
          status,
          amount,
          currency_code,
          external_transaction_id,
          failure_reason,
          processed_at,
          metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
        RETURNING
          id,
          invoice_id,
          store_id,
          provider,
          payment_method,
          status,
          amount,
          currency_code,
          external_transaction_id,
          failure_reason,
          processed_at,
          metadata,
          created_at
      `,
      [
        uuidv4(),
        input.invoiceId,
        input.storeId,
        input.provider,
        input.paymentMethod,
        input.status,
        input.amount,
        input.currencyCode,
        input.externalTransactionId ?? null,
        input.failureReason ?? null,
        input.processedAt ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    );

    return result.rows[0] as SubscriptionPaymentRecord;
  }

  async findPlatformInvoiceDetailsById(
    invoiceId: string,
  ): Promise<PlatformInvoiceDetailsRecord | null> {
    const result = await this.databaseService.db.query<PlatformInvoiceDetailsRecord>(
      `
        SELECT
          i.id,
          i.store_id,
          i.subscription_id,
          i.plan_id,
          i.invoice_number,
          i.billing_cycle,
          i.period_start,
          i.period_end,
          i.subtotal_amount,
          i.tax_amount,
          i.total_amount,
          i.currency_code,
          i.status,
          i.due_at,
          i.paid_at,
          i.external_invoice_id,
          i.metadata,
          i.original_amount,
          i.discount_amount,
          i.coupon_code,
          i.created_at,
          i.updated_at,
          s.name AS store_name,
          s.slug AS store_slug,
          p.code AS plan_code,
          p.name AS plan_name,
          ss.status AS subscription_status
        FROM subscription_invoices i
        INNER JOIN stores s
          ON s.id = i.store_id
        LEFT JOIN plans p
          ON p.id = i.plan_id
        LEFT JOIN store_subscriptions ss
          ON ss.id = i.subscription_id
        WHERE i.id = $1
        LIMIT 1
      `,
      [invoiceId],
    );
    return result.rows[0] ?? null;
  }

  async listPaymentsByInvoice(invoiceId: string): Promise<SubscriptionPaymentRecord[]> {
    const result = await this.databaseService.db.query<SubscriptionPaymentRecord>(
      `
        SELECT
          id,
          invoice_id,
          store_id,
          provider,
          payment_method,
          status,
          amount,
          currency_code,
          external_transaction_id,
          failure_reason,
          processed_at,
          metadata,
          created_at
        FROM subscription_payments
        WHERE invoice_id = $1
        ORDER BY created_at DESC
      `,
      [invoiceId],
    );
    return result.rows;
  }

  async listPaymentsByStore(storeId: string, limit = 25): Promise<SubscriptionPaymentRecord[]> {
    const result = await this.databaseService.db.query<SubscriptionPaymentRecord>(
      `
        SELECT
          id,
          invoice_id,
          store_id,
          provider,
          payment_method,
          status,
          amount,
          currency_code,
          external_transaction_id,
          failure_reason,
          processed_at,
          metadata,
          created_at
        FROM subscription_payments
        WHERE store_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      `,
      [storeId, limit],
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

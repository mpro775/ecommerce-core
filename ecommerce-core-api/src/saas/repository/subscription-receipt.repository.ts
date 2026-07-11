import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../../database/database.service';
import type {
  Queryable,
  SubscriptionInvoiceRecord,
  SubscriptionPaymentReceiptRecord,
  SubscriptionPaymentReceiptStatus,
} from './types';

export interface ListSubscriptionReceiptsQuery {
  status?: SubscriptionPaymentReceiptStatus;
  storeId?: string;
  invoiceId?: string;
  q?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class SubscriptionReceiptRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async createReceipt(
    input: {
      storeId: string;
      subscriptionId: string | null;
      invoiceId: string;
      paymentMethodId?: string | null;
      paymentMethodCode?: string | null;
      paymentMethodName?: string | null;
      amount: number;
      currencyCode: string;
      transactionReference?: string | null;
      paidAt?: Date | null;
      receiptMediaId?: string | null;
      receiptUrl?: string | null;
      receiptFileName?: string | null;
      receiptMimeType?: string | null;
      receiptSizeBytes?: number | null;
      merchantNote?: string | null;
      createdByUserId?: string | null;
      metadata?: Record<string, unknown>;
    },
    db?: Queryable,
  ): Promise<SubscriptionPaymentReceiptRecord> {
    const queryable = db ?? this.databaseService.db;
    const result = await queryable.query<SubscriptionPaymentReceiptRecord>(
      `
        INSERT INTO subscription_payment_receipts (
          id,
          store_id,
          subscription_id,
          invoice_id,
          payment_method_id,
          payment_method_code,
          payment_method_name,
          amount,
          currency_code,
          transaction_reference,
          paid_at,
          receipt_media_id,
          receipt_url,
          receipt_file_name,
          receipt_mime_type,
          receipt_size_bytes,
          merchant_note,
          created_by_user_id,
          metadata
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19::jsonb
        )
        RETURNING *
      `,
      [
        uuidv4(),
        input.storeId,
        input.subscriptionId,
        input.invoiceId,
        input.paymentMethodId ?? null,
        input.paymentMethodCode ?? null,
        input.paymentMethodName ?? null,
        input.amount,
        input.currencyCode,
        input.transactionReference ?? null,
        input.paidAt ?? null,
        input.receiptMediaId ?? null,
        input.receiptUrl ?? null,
        input.receiptFileName ?? null,
        input.receiptMimeType ?? null,
        input.receiptSizeBytes ?? null,
        input.merchantNote ?? null,
        input.createdByUserId ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
    return result.rows[0] as SubscriptionPaymentReceiptRecord;
  }

  async listReceipts(query: ListSubscriptionReceiptsQuery): Promise<{
    items: SubscriptionPaymentReceiptRecord[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 25));
    const values: unknown[] = [];
    const filters = ['r.deleted_at IS NULL'];

    if (query.status) {
      values.push(query.status);
      filters.push(`r.status = $${values.length}`);
    }
    if (query.storeId) {
      values.push(query.storeId);
      filters.push(`r.store_id = $${values.length}`);
    }
    if (query.invoiceId) {
      values.push(query.invoiceId);
      filters.push(`r.invoice_id = $${values.length}`);
    }
    if (query.q?.trim()) {
      values.push(`%${query.q.trim()}%`);
      filters.push(
        `(r.transaction_reference ILIKE $${values.length} OR i.invoice_number ILIKE $${values.length} OR s.name ILIKE $${values.length})`,
      );
    }

    const whereSql = filters.join(' AND ');
    const countResult = await this.databaseService.db.query<{ total: string }>(
      `
        SELECT COUNT(*)::text AS total
        FROM subscription_payment_receipts r
        INNER JOIN subscription_invoices i ON i.id = r.invoice_id
        INNER JOIN stores s ON s.id = r.store_id
        WHERE ${whereSql}
      `,
      values,
    );

    values.push(limit, (page - 1) * limit);
    const result = await this.databaseService.db.query<SubscriptionPaymentReceiptRecord>(
      `
        SELECT
          r.*,
          s.name AS store_name,
          s.slug AS store_slug,
          i.invoice_number,
          i.status AS invoice_status
        FROM subscription_payment_receipts r
        INNER JOIN subscription_invoices i ON i.id = r.invoice_id
        INNER JOIN stores s ON s.id = r.store_id
        WHERE ${whereSql}
        ORDER BY r.created_at DESC
        LIMIT $${values.length - 1}
        OFFSET $${values.length}
      `,
      values,
    );

    return {
      items: result.rows,
      total: Number(countResult.rows[0]?.total ?? '0'),
      page,
      limit,
    };
  }

  async findReceiptById(
    receiptId: string,
    db?: Queryable,
  ): Promise<SubscriptionPaymentReceiptRecord | null> {
    const queryable = db ?? this.databaseService.db;
    const result = await queryable.query<SubscriptionPaymentReceiptRecord>(
      `
        SELECT *
        FROM subscription_payment_receipts
        WHERE id = $1
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [receiptId],
    );
    return result.rows[0] ?? null;
  }

  async findReceiptByIdForUpdate(
    receiptId: string,
    db: Queryable,
  ): Promise<SubscriptionPaymentReceiptRecord | null> {
    const result = await db.query<SubscriptionPaymentReceiptRecord>(
      `
        SELECT *
        FROM subscription_payment_receipts
        WHERE id = $1
          AND deleted_at IS NULL
        LIMIT 1
        FOR UPDATE
      `,
      [receiptId],
    );
    return result.rows[0] ?? null;
  }

  async findInvoiceForUpdate(
    invoiceId: string,
    db: Queryable,
  ): Promise<SubscriptionInvoiceRecord | null> {
    const result = await db.query<SubscriptionInvoiceRecord>(
      `
        SELECT *
        FROM subscription_invoices
        WHERE id = $1
        LIMIT 1
        FOR UPDATE
      `,
      [invoiceId],
    );
    return result.rows[0] ?? null;
  }

  async hasApprovedReceiptForInvoice(invoiceId: string, db?: Queryable): Promise<boolean> {
    const queryable = db ?? this.databaseService.db;
    const result = await queryable.query<{ exists: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM subscription_payment_receipts
          WHERE invoice_id = $1
            AND status = 'approved'
            AND deleted_at IS NULL
        ) AS exists
      `,
      [invoiceId],
    );
    return Boolean(result.rows[0]?.exists);
  }

  async hasPendingReceiptForInvoice(invoiceId: string, db?: Queryable): Promise<boolean> {
    const queryable = db ?? this.databaseService.db;
    const result = await queryable.query<{ exists: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM subscription_payment_receipts
          WHERE invoice_id = $1
            AND status = 'pending_review'
            AND deleted_at IS NULL
        ) AS exists
      `,
      [invoiceId],
    );
    return Boolean(result.rows[0]?.exists);
  }

  async findReceiptMediaAsset(
    storeId: string,
    mediaAssetId: string,
    db?: Queryable,
  ): Promise<{
    id: string;
    public_url: string;
    mime_type: string;
    file_size_bytes: number;
    metadata: Record<string, unknown>;
  } | null> {
    const queryable = db ?? this.databaseService.db;
    const result = await queryable.query<{
      id: string;
      public_url: string;
      mime_type: string;
      file_size_bytes: number;
      metadata: Record<string, unknown>;
    }>(
      `
        SELECT id, public_url, mime_type, file_size_bytes, metadata
        FROM media_assets
        WHERE id = $1
          AND store_id = $2
        LIMIT 1
      `,
      [mediaAssetId, storeId],
    );
    return result.rows[0] ?? null;
  }

  async markReceiptReviewed(
    db: Queryable,
    input: {
      receiptId: string;
      status: 'approved' | 'rejected';
      paymentId?: string | null;
      reviewedByAdminId: string;
      adminNote?: string | null;
      rejectionReason?: string | null;
      metadata?: Record<string, unknown>;
    },
  ): Promise<SubscriptionPaymentReceiptRecord> {
    const result = await db.query<SubscriptionPaymentReceiptRecord>(
      `
        UPDATE subscription_payment_receipts
        SET status = $2,
            payment_id = COALESCE($3, payment_id),
            reviewed_by_admin_id = $4,
            reviewed_at = NOW(),
            admin_note = $5,
            rejection_reason = $6,
            metadata = metadata || $7::jsonb,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [
        input.receiptId,
        input.status,
        input.paymentId ?? null,
        input.reviewedByAdminId,
        input.adminNote ?? null,
        input.rejectionReason ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
    return result.rows[0] as SubscriptionPaymentReceiptRecord;
  }
}

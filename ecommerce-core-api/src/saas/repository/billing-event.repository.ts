import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../../database/database.service';
import type { BillingEventRecord, Queryable } from './types';

@Injectable()
export class BillingEventRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async findBillingEventBySourceAndIdempotency(
    source: BillingEventRecord['source'],
    idempotencyKey: string,
  ): Promise<BillingEventRecord | null> {
    const result = await this.databaseService.db.query<BillingEventRecord>(
      `
        SELECT
          id,
          store_id,
          source,
          event_type,
          idempotency_key,
          payload,
          status,
          processing_error,
          processed_at,
          created_at
        FROM billing_events
        WHERE source = $1
          AND idempotency_key = $2
        LIMIT 1
      `,
      [source, idempotencyKey],
    );
    return result.rows[0] ?? null;
  }

  async createBillingEvent(
    input: {
      storeId: string | null;
      source: BillingEventRecord['source'];
      eventType: string;
      idempotencyKey: string | null;
      payload: Record<string, unknown>;
      status: BillingEventRecord['status'];
      processingError?: string | null;
      processedAt?: Date | null;
    },
    db?: Queryable,
  ): Promise<BillingEventRecord> {
    const queryable = db ?? this.databaseService.db;
    const result = await queryable.query<BillingEventRecord>(
      `
        INSERT INTO billing_events (
          id,
          store_id,
          source,
          event_type,
          idempotency_key,
          payload,
          status,
          processing_error,
          processed_at
        ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)
        RETURNING
          id,
          store_id,
          source,
          event_type,
          idempotency_key,
          payload,
          status,
          processing_error,
          processed_at,
          created_at
      `,
      [
        uuidv4(),
        input.storeId,
        input.source,
        input.eventType,
        input.idempotencyKey,
        JSON.stringify(input.payload),
        input.status,
        input.processingError ?? null,
        input.processedAt ?? null,
      ],
    );
    return result.rows[0] as BillingEventRecord;
  }

  async updateBillingEventStatus(input: {
    billingEventId: string;
    status: BillingEventRecord['status'];
    processingError?: string | null;
    processedAt?: Date | null;
  }): Promise<boolean> {
    const result = await this.databaseService.db.query(
      `
        UPDATE billing_events
        SET status = $2,
            processing_error = $3,
            processed_at = $4,
            updated_at = NOW()
        WHERE id = $1
      `,
      [
        input.billingEventId,
        input.status,
        input.processingError ?? null,
        input.processedAt ?? null,
      ],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async listRecentBillingEvents(limit: number): Promise<BillingEventRecord[]> {
    const result = await this.databaseService.db.query<BillingEventRecord>(
      `
        SELECT
          id,
          store_id,
          source,
          event_type,
          idempotency_key,
          payload,
          status,
          processing_error,
          processed_at,
          created_at
        FROM billing_events
        ORDER BY created_at DESC
        LIMIT $1
      `,
      [limit],
    );
    return result.rows;
  }
}

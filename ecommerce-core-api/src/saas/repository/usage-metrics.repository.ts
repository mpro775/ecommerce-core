import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class UsageMetricsRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async recordUsageEvent(input: {
    storeId: string;
    metricKey: string;
    quantity: number;
    metadata: Record<string, unknown>;
  }): Promise<void> {
    await this.databaseService.db.query(
      `
        INSERT INTO usage_events (id, store_id, metric_key, quantity, happened_at, metadata)
        VALUES ($1, $2, $3, $4, NOW(), $5::jsonb)
      `,
      [uuidv4(), input.storeId, input.metricKey, input.quantity, JSON.stringify(input.metadata)],
    );
  }

  async countProducts(storeId: string): Promise<number> {
    const result = await this.databaseService.db.query<{ total: string }>(
      `
        SELECT COUNT(*)::text AS total
        FROM products
        WHERE store_id = $1
      `,
      [storeId],
    );
    return Number(result.rows[0]?.total ?? '0');
  }

  async countStaff(storeId: string): Promise<number> {
    const result = await this.databaseService.db.query<{ total: string }>(
      `
        SELECT COUNT(*)::text AS total
        FROM store_users
        WHERE store_id = $1
          AND is_active = TRUE
      `,
      [storeId],
    );
    return Number(result.rows[0]?.total ?? '0');
  }

  async countOrdersForMonth(storeId: string, at: Date): Promise<number> {
    const periodStart = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
    const periodEnd = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1));

    const result = await this.databaseService.db.query<{ total: string }>(
      `
        SELECT COUNT(*)::text AS total
        FROM orders
        WHERE store_id = $1
          AND created_at >= $2
          AND created_at < $3
      `,
      [storeId, periodStart, periodEnd],
    );
    return Number(result.rows[0]?.total ?? '0');
  }

  async countDomains(storeId: string): Promise<number> {
    const result = await this.databaseService.db.query<{ total: string }>(
      `
        SELECT COUNT(*)::text AS total
        FROM store_domains
        WHERE store_id = $1
      `,
      [storeId],
    );
    return Number(result.rows[0]?.total ?? '0');
  }

  async getStorageUsedBytes(storeId: string): Promise<number> {
    const result = await this.databaseService.db.query<{ total_bytes: string | null }>(
      `
        SELECT COALESCE(SUM(file_size_bytes), 0)::text AS total_bytes
        FROM media_assets
        WHERE store_id = $1
      `,
      [storeId],
    );
    return Number(result.rows[0]?.total_bytes ?? '0');
  }

  async countApiCallsForMonth(storeId: string, at: Date): Promise<number> {
    const periodStart = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
    const periodEnd = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1));

    const result = await this.databaseService.db.query<{ total: string }>(
      `
        SELECT COALESCE(SUM(quantity), 0)::text AS total
        FROM usage_events
        WHERE store_id = $1
          AND metric_key = 'api_calls.monthly'
          AND happened_at >= $2
          AND happened_at < $3
      `,
      [storeId, periodStart, periodEnd],
    );
    return Number(result.rows[0]?.total ?? '0');
  }

  async countWebhooksForMonth(storeId: string, at: Date): Promise<number> {
    const periodStart = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
    const periodEnd = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1));

    const result = await this.databaseService.db.query<{ total: string }>(
      `
        SELECT COALESCE(SUM(quantity), 0)::text AS total
        FROM usage_events
        WHERE store_id = $1
          AND metric_key = 'webhooks.monthly'
          AND happened_at >= $2
          AND happened_at < $3
      `,
      [storeId, periodStart, periodEnd],
    );
    return Number(result.rows[0]?.total ?? '0');
  }

  async pingPostgres(): Promise<void> {
    await this.databaseService.pingPostgres();
  }

  async pingRedis(): Promise<void> {
    await this.databaseService.pingRedis();
  }
}

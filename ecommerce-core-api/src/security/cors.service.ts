import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { DatabaseService } from '../database/database.service';

interface CachedDomain {
  storeId: string;
  hostname: string;
  cachedAt: number;
}

@Injectable()
export class CorsService {
  private readonly logger = new Logger(CorsService.name);
  private readonly domainCache: Map<string, CachedDomain> = new Map();
  private readonly cacheTtlMs: number;
  private lastCacheRefresh = 0;
  private cacheRefreshIntervalMs: number;
  private refreshPromise: Promise<void> | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
  ) {
    this.cacheTtlMs = this.configService.get<number>('CORS_CACHE_TTL_MS', 60_000);
    this.cacheRefreshIntervalMs = this.configService.get<number>(
      'CORS_CACHE_REFRESH_INTERVAL_MS',
      30_000,
    );
  }

  async isOriginAllowed(origin: string | undefined, request?: Request): Promise<boolean> {
    if (!origin) {
      return true;
    }

    try {
      const originUrl = new URL(origin);
      const hostname = originUrl.hostname;

      const allowedStaticOrigins = this.getStaticAllowedOrigins();
      if (allowedStaticOrigins.some((o) => o === origin || o.includes(hostname))) {
        return true;
      }

      await this.refreshCacheIfNeeded();

      const cached = this.domainCache.get(hostname);
      if (cached && Date.now() - cached.cachedAt < this.cacheTtlMs) {
        return true;
      }

      const isCustomDomain = await this.checkActiveDomain(hostname);
      return isCustomDomain;
    } catch {
      return false;
    }
  }

  async getStoreIdForOrigin(origin: string): Promise<string | null> {
    try {
      const originUrl = new URL(origin);
      const hostname = originUrl.hostname;

      const cached = this.domainCache.get(hostname);
      if (cached && Date.now() - cached.cachedAt < this.cacheTtlMs) {
        return cached.storeId;
      }

      const result = await this.databaseService.db.query<{ store_id: string }>(
        `
        SELECT store_id 
        FROM store_domains 
        WHERE hostname = $1 AND status = 'active'
        LIMIT 1
        `,
        [hostname],
      );

      if (result.rows.length > 0 && result.rows[0]) {
        const storeId = result.rows[0].store_id;
        this.domainCache.set(hostname, {
          storeId,
          hostname,
          cachedAt: Date.now(),
        });
        return storeId;
      }

      return null;
    } catch {
      return null;
    }
  }

  async getAllowedOrigins(): Promise<string[]> {
    const origins: string[] = [];

    const staticOrigins = this.getStaticAllowedOrigins();
    origins.push(...staticOrigins);

    await this.refreshCacheIfNeeded();

    for (const [hostname, cached] of this.domainCache) {
      if (Date.now() - cached.cachedAt < this.cacheTtlMs) {
        origins.push(`https://${hostname}`);
      }
    }

    return [...new Set(origins)];
  }

  invalidateCache(hostname?: string): void {
    if (hostname) {
      this.domainCache.delete(hostname);
      this.logger.log(`Cache invalidated for: ${hostname}`);
    } else {
      this.domainCache.clear();
      this.lastCacheRefresh = 0;
      this.logger.log('Full cache invalidated');
    }
  }

  private getStaticAllowedOrigins(): string[] {
    const allowedOrigins = this.configService.get<string>('ALLOWED_ORIGINS', '');
    if (!allowedOrigins) {
      return ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:3001'];
    }
    return allowedOrigins
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
  }

  private async refreshCacheIfNeeded(): Promise<void> {
    const now = Date.now();

    if (now - this.lastCacheRefresh < this.cacheRefreshIntervalMs) {
      return;
    }

    if (this.refreshPromise) {
      await this.refreshPromise;
      return;
    }

    this.refreshPromise = this.doRefreshCache();
    try {
      await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async doRefreshCache(): Promise<void> {
    try {
      const result = await this.databaseService.db.query<{ store_id: string; hostname: string }>(
        `
        SELECT store_id, hostname 
        FROM store_domains 
        WHERE status = 'active'
        `,
      );

      const now = Date.now();
      for (const row of result.rows) {
        this.domainCache.set(row.hostname, {
          storeId: row.store_id,
          hostname: row.hostname,
          cachedAt: now,
        });
      }

      this.lastCacheRefresh = now;
      this.logger.debug(`Cache refreshed: ${result.rows.length} active domains`);
    } catch (error) {
      this.logger.error(
        'Failed to refresh domain cache',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private async checkActiveDomain(hostname: string): Promise<boolean> {
    try {
      const result = await this.databaseService.db.query<{ exists: boolean }>(
        `
        SELECT EXISTS(
          SELECT 1 FROM store_domains 
          WHERE hostname = $1 AND status = 'active'
        ) as exists
        `,
        [hostname],
      );

      const exists = result.rows[0]?.exists ?? false;

      if (exists) {
        const storeResult = await this.databaseService.db.query<{ store_id: string }>(
          `
          SELECT store_id FROM store_domains 
          WHERE hostname = $1 AND status = 'active'
          LIMIT 1
          `,
          [hostname],
        );

        const storeRow = storeResult.rows[0];
        if (storeRow) {
          this.domainCache.set(hostname, {
            storeId: storeRow.store_id,
            hostname,
            cachedAt: Date.now(),
          });
        }
      }

      return exists;
    } catch (error) {
      this.logger.error(
        `Failed to check domain: ${hostname}`,
        error instanceof Error ? error.message : String(error),
      );
      return false;
    }
  }
}

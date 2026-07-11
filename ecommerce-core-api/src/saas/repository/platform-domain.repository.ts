import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import type { PlatformDomainRecord } from './types';

@Injectable()
export class PlatformDomainRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async listPlatformDomains(): Promise<PlatformDomainRecord[]> {
    const result = await this.databaseService.db.query<PlatformDomainRecord>(
      `
        SELECT
          d.id,
          d.store_id,
          s.name AS store_name,
          d.hostname,
          d.status,
          d.ssl_status,
          d.support_required,
          d.technical_error_code,
          d.technical_error_message,
          d.last_dns_check_at,
          d.last_dns_check_result,
          d.updated_at
        FROM store_domains d
        INNER JOIN stores s ON s.id = d.store_id
        ORDER BY d.updated_at DESC
      `,
    );
    return result.rows;
  }

  async listPlatformDomainIssues(limit: number): Promise<PlatformDomainRecord[]> {
    const result = await this.databaseService.db.query<PlatformDomainRecord>(
      `
        SELECT
          d.id,
          d.store_id,
          s.name AS store_name,
          d.hostname,
          d.status,
          d.ssl_status,
          d.ssl_provider,
          d.ssl_mode,
          d.ssl_last_checked_at,
          d.ssl_error,
          d.cloudflare_zone_id,
          d.cloudflare_hostname_id,
          d.last_dns_check_at,
          d.last_dns_check_result,
          d.support_required,
          d.technical_error_code,
          d.technical_error_message,
          d.verification_token,
          d.verified_at,
          d.activated_at,
          d.updated_at
        FROM store_domains d
        INNER JOIN stores s ON s.id = d.store_id
        WHERE d.ssl_status = 'error'
           OR d.status = 'pending'
        ORDER BY d.updated_at DESC
        LIMIT $1
      `,
      [limit],
    );
    return result.rows;
  }

  async findPlatformDomainById(domainId: string): Promise<PlatformDomainRecord | null> {
    const result = await this.databaseService.db.query<PlatformDomainRecord>(
      `
        SELECT
          d.id,
          d.store_id,
          s.name AS store_name,
          d.hostname,
          d.status,
          d.ssl_status,
          d.ssl_provider,
          d.ssl_mode,
          d.ssl_last_checked_at,
          d.ssl_error,
          d.cloudflare_zone_id,
          d.cloudflare_hostname_id,
          d.last_dns_check_at,
          d.last_dns_check_result,
          d.support_required,
          d.technical_error_code,
          d.technical_error_message,
          d.verification_token,
          d.verified_at,
          d.activated_at,
          d.updated_at
        FROM store_domains d
        INNER JOIN stores s ON s.id = d.store_id
        WHERE d.id = $1
        LIMIT 1
      `,
      [domainId],
    );
    return result.rows[0] ?? null;
  }

  async listPlatformDomainsByStore(storeId: string): Promise<PlatformDomainRecord[]> {
    const result = await this.databaseService.db.query<PlatformDomainRecord>(
      `
        SELECT
          d.id,
          d.store_id,
          s.name AS store_name,
          d.hostname,
          d.status,
          d.ssl_status,
          d.ssl_provider,
          d.ssl_mode,
          d.ssl_last_checked_at,
          d.ssl_error,
          d.cloudflare_zone_id,
          d.cloudflare_hostname_id,
          d.last_dns_check_at,
          d.last_dns_check_result,
          d.support_required,
          d.technical_error_code,
          d.technical_error_message,
          d.verification_token,
          d.verified_at,
          d.activated_at,
          d.updated_at
        FROM store_domains d
        INNER JOIN stores s ON s.id = d.store_id
        WHERE d.store_id = $1
        ORDER BY d.updated_at DESC
      `,
      [storeId],
    );
    return result.rows;
  }

  async touchPlatformDomainCheck(domainId: string): Promise<PlatformDomainRecord | null> {
    const result = await this.databaseService.db.query<PlatformDomainRecord>(
      `
        UPDATE store_domains
        SET ssl_last_checked_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
        RETURNING
          id,
          store_id,
          ''::text AS store_name,
          hostname,
          status,
          ssl_status,
          ssl_provider,
          ssl_mode,
          ssl_last_checked_at,
          ssl_error,
          cloudflare_zone_id,
          cloudflare_hostname_id,
          last_dns_check_at,
          last_dns_check_result,
          support_required,
          technical_error_code,
          technical_error_message,
          verification_token,
          verified_at,
          activated_at,
          updated_at
      `,
      [domainId],
    );

    return result.rows[0] ?? null;
  }
}

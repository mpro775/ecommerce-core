import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';

export interface StoreDomainRecord {
  id: string;
  store_id: string;
  hostname: string;
  verification_token: string;
  status: 'pending' | 'verified' | 'active';
  ssl_status: 'pending' | 'requested' | 'issued' | 'error';
  ssl_provider: 'manual' | 'cloudflare';
  ssl_mode: 'full' | 'full_strict';
  cloudflare_zone_id: string | null;
  cloudflare_hostname_id: string | null;
  ssl_validation_records: unknown;
  last_dns_check_at: Date | null;
  last_dns_check_result: unknown;
  support_required: boolean;
  technical_error_code: string | null;
  technical_error_message: string | null;
  ssl_last_checked_at: Date | null;
  ssl_error: string | null;
  verified_at: Date | null;
  activated_at: Date | null;
}

@Injectable()
export class DomainsRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(input: {
    storeId: string;
    hostname: string;
    verificationToken: string;
    sslProvider: 'manual' | 'cloudflare';
    sslMode: 'full' | 'full_strict';
    cloudflareZoneId: string | null;
  }): Promise<StoreDomainRecord> {
    const result = await this.databaseService.db.query<StoreDomainRecord>(
      `
        INSERT INTO store_domains (
          id,
          store_id,
          hostname,
          verification_token,
          status,
          ssl_status,
          ssl_provider,
          ssl_mode,
          cloudflare_zone_id
        ) VALUES ($1, $2, $3, $4, 'pending', 'pending', $5, $6, $7)
        RETURNING id, store_id, hostname, verification_token, status, ssl_status,
                  ssl_provider, ssl_mode, cloudflare_zone_id, cloudflare_hostname_id,
                  ssl_validation_records, last_dns_check_at, last_dns_check_result,
                  support_required, technical_error_code, technical_error_message,
                  ssl_last_checked_at, ssl_error, verified_at, activated_at
      `,
      [
        uuidv4(),
        input.storeId,
        input.hostname,
        input.verificationToken,
        input.sslProvider,
        input.sslMode,
        input.cloudflareZoneId,
      ],
    );
    return result.rows[0] as StoreDomainRecord;
  }

  async list(storeId: string): Promise<StoreDomainRecord[]> {
    const result = await this.databaseService.db.query<StoreDomainRecord>(
      `
        SELECT id, store_id, hostname, verification_token, status, ssl_status, verified_at, activated_at
               , ssl_provider, ssl_mode, cloudflare_zone_id, cloudflare_hostname_id,
                 ssl_validation_records, last_dns_check_at, last_dns_check_result,
                 support_required, technical_error_code, technical_error_message,
                 ssl_last_checked_at, ssl_error
        FROM store_domains
        WHERE store_id = $1
        ORDER BY created_at DESC
      `,
      [storeId],
    );
    return result.rows;
  }

  async findById(storeId: string, domainId: string): Promise<StoreDomainRecord | null> {
    const result = await this.databaseService.db.query<StoreDomainRecord>(
      `
        SELECT id, store_id, hostname, verification_token, status, ssl_status, verified_at, activated_at
               , ssl_provider, ssl_mode, cloudflare_zone_id, cloudflare_hostname_id,
                 ssl_validation_records, last_dns_check_at, last_dns_check_result,
                 support_required, technical_error_code, technical_error_message,
                 ssl_last_checked_at, ssl_error
        FROM store_domains
        WHERE store_id = $1
          AND id = $2
        LIMIT 1
      `,
      [storeId, domainId],
    );
    return result.rows[0] ?? null;
  }

  async markVerified(storeId: string, domainId: string): Promise<StoreDomainRecord | null> {
    const result = await this.databaseService.db.query<StoreDomainRecord>(
      `
        UPDATE store_domains
        SET status = 'verified',
            verified_at = COALESCE(verified_at, NOW()),
            updated_at = NOW()
        WHERE store_id = $1
          AND id = $2
        RETURNING id, store_id, hostname, verification_token, status, ssl_status, verified_at, activated_at
                  , ssl_provider, ssl_mode, cloudflare_zone_id, cloudflare_hostname_id,
                    ssl_validation_records, last_dns_check_at, last_dns_check_result,
                    support_required, technical_error_code, technical_error_message,
                    ssl_last_checked_at, ssl_error
      `,
      [storeId, domainId],
    );
    return result.rows[0] ?? null;
  }

  async markActive(input: {
    storeId: string;
    domainId: string;
    sslStatus: 'requested' | 'issued' | 'error';
    cloudflareHostnameId: string | null;
    sslError: string | null;
    validationRecords?: unknown;
    technicalErrorCode?: string | null;
    technicalErrorMessage?: string | null;
  }): Promise<StoreDomainRecord | null> {
    const result = await this.databaseService.db.query<StoreDomainRecord>(
      `
        UPDATE store_domains
        SET status = 'active',
            ssl_status = $3,
            cloudflare_hostname_id = COALESCE($4, cloudflare_hostname_id),
            ssl_validation_records = COALESCE($6::jsonb, ssl_validation_records),
            ssl_last_checked_at = NOW(),
            ssl_error = $5,
            technical_error_code = $7,
            technical_error_message = $8,
            support_required = ($3 = 'error'),
            activated_at = COALESCE(activated_at, NOW()),
            updated_at = NOW()
        WHERE store_id = $1
          AND id = $2
        RETURNING id, store_id, hostname, verification_token, status, ssl_status,
                  ssl_provider, ssl_mode, cloudflare_zone_id, cloudflare_hostname_id,
                  ssl_validation_records, last_dns_check_at, last_dns_check_result,
                  support_required, technical_error_code, technical_error_message,
                  ssl_last_checked_at, ssl_error, verified_at, activated_at
      `,
      [
        input.storeId,
        input.domainId,
        input.sslStatus,
        input.cloudflareHostnameId,
        input.sslError,
        input.validationRecords ? JSON.stringify(input.validationRecords) : null,
        input.technicalErrorCode ?? null,
        input.technicalErrorMessage ?? null,
      ],
    );
    return result.rows[0] ?? null;
  }

  async updateSslState(input: {
    storeId: string;
    domainId: string;
    sslStatus: 'requested' | 'issued' | 'error';
    cloudflareHostnameId?: string | null;
    sslError: string | null;
    validationRecords?: unknown;
    technicalErrorCode?: string | null;
    technicalErrorMessage?: string | null;
  }): Promise<StoreDomainRecord | null> {
    const result = await this.databaseService.db.query<StoreDomainRecord>(
      `
        UPDATE store_domains
        SET ssl_status = $3,
            cloudflare_hostname_id = COALESCE($4, cloudflare_hostname_id),
            ssl_validation_records = COALESCE($6::jsonb, ssl_validation_records),
            ssl_last_checked_at = NOW(),
            ssl_error = $5,
            technical_error_code = $7,
            technical_error_message = $8,
            support_required = ($3 = 'error'),
            updated_at = NOW()
        WHERE store_id = $1
          AND id = $2
        RETURNING id, store_id, hostname, verification_token, status, ssl_status,
                  ssl_provider, ssl_mode, cloudflare_zone_id, cloudflare_hostname_id,
                  ssl_validation_records, last_dns_check_at, last_dns_check_result,
                  support_required, technical_error_code, technical_error_message,
                  ssl_last_checked_at, ssl_error, verified_at, activated_at
      `,
      [
        input.storeId,
        input.domainId,
        input.sslStatus,
        input.cloudflareHostnameId ?? null,
        input.sslError,
        input.validationRecords ? JSON.stringify(input.validationRecords) : null,
        input.technicalErrorCode ?? null,
        input.technicalErrorMessage ?? null,
      ],
    );

    return result.rows[0] ?? null;
  }

  async updateDnsCheck(input: {
    storeId: string;
    domainId: string;
    result: unknown;
  }): Promise<StoreDomainRecord | null> {
    const queryResult = await this.databaseService.db.query<StoreDomainRecord>(
      `
        UPDATE store_domains
        SET last_dns_check_at = NOW(),
            last_dns_check_result = $3::jsonb,
            updated_at = NOW()
        WHERE store_id = $1
          AND id = $2
        RETURNING id, store_id, hostname, verification_token, status, ssl_status,
                  ssl_provider, ssl_mode, cloudflare_zone_id, cloudflare_hostname_id,
                  ssl_validation_records, last_dns_check_at, last_dns_check_result,
                  support_required, technical_error_code, technical_error_message,
                  ssl_last_checked_at, ssl_error, verified_at, activated_at
      `,
      [input.storeId, input.domainId, JSON.stringify(input.result)],
    );

    return queryResult.rows[0] ?? null;
  }

  async listSslSyncCandidates(limit: number): Promise<StoreDomainRecord[]> {
    const result = await this.databaseService.db.query<StoreDomainRecord>(
      `
        SELECT id, store_id, hostname, verification_token, status, ssl_status,
               ssl_provider, ssl_mode, cloudflare_zone_id, cloudflare_hostname_id,
               ssl_validation_records, last_dns_check_at, last_dns_check_result,
               support_required, technical_error_code, technical_error_message,
               ssl_last_checked_at, ssl_error, verified_at, activated_at
        FROM store_domains
        WHERE ssl_provider = 'cloudflare'
          AND status IN ('verified', 'active')
          AND ssl_status IN ('pending', 'requested', 'error')
          AND (
            ssl_last_checked_at IS NULL
            OR ssl_last_checked_at < NOW() - INTERVAL '5 minutes'
          )
        ORDER BY COALESCE(ssl_last_checked_at, created_at) ASC
        LIMIT $1
      `,
      [limit],
    );

    return result.rows;
  }

  async markVerifiedWithSslError(input: {
    storeId: string;
    domainId: string;
    sslError: string;
    technicalErrorCode?: string | null;
    technicalErrorMessage?: string | null;
  }): Promise<StoreDomainRecord | null> {
    const result = await this.databaseService.db.query<StoreDomainRecord>(
      `
        UPDATE store_domains
        SET status = 'verified',
            ssl_status = 'error',
            ssl_error = $3,
            support_required = true,
            technical_error_code = $4,
            technical_error_message = $5,
            verified_at = COALESCE(verified_at, NOW()),
            activated_at = NULL,
            updated_at = NOW()
        WHERE store_id = $1
          AND id = $2
        RETURNING id, store_id, hostname, verification_token, status, ssl_status,
                  ssl_provider, ssl_mode, cloudflare_zone_id, cloudflare_hostname_id,
                  ssl_validation_records, last_dns_check_at, last_dns_check_result,
                  support_required, technical_error_code, technical_error_message,
                  ssl_last_checked_at, ssl_error, verified_at, activated_at
      `,
      [
        input.storeId,
        input.domainId,
        input.sslError,
        input.technicalErrorCode ?? null,
        input.technicalErrorMessage ?? null,
      ],
    );
    return result.rows[0] ?? null;
  }

  async delete(storeId: string, domainId: string): Promise<boolean> {
    const result = await this.databaseService.db.query(
      `
        DELETE FROM store_domains
        WHERE store_id = $1
          AND id = $2
      `,
      [storeId, domainId],
    );
    return (result.rowCount ?? 0) > 0;
  }
}

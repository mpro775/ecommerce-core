import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface CloudflareApiEnvelope<T> {
  success: boolean;
  errors?: Array<{ code: number; message: string }>;
  result?: T;
}

export interface DomainProviderErrorDetails {
  code:
    | 'CF_TOKEN_INVALID'
    | 'CF_CUSTOM_HOSTNAME_QUOTA_MISSING'
    | 'CF_FALLBACK_ORIGIN_INACTIVE'
    | 'CF_CERTIFICATE_AUTHORITY_NOT_ALLOWED'
    | 'CF_CUSTOM_ORIGIN_SNI_NOT_ALLOWED'
    | 'CF_VALIDATION_PENDING'
    | 'CF_RATE_LIMIT'
    | 'CF_REQUEST_FAILED';
  userMessage: string;
  technicalMessage: string;
}

export class DomainProviderException extends Error {
  readonly code: DomainProviderErrorDetails['code'];
  readonly userMessage: string;
  readonly technicalMessage: string;

  constructor(details: DomainProviderErrorDetails) {
    super(details.userMessage);
    this.name = 'DomainProviderException';
    this.code = details.code;
    this.userMessage = details.userMessage;
    this.technicalMessage = details.technicalMessage;
  }
}

export interface CloudflareValidationRecord {
  type: 'CNAME' | 'TXT';
  name: string;
  value: string;
}

interface CloudflareCustomHostnameResult {
  id: string;
  hostname: string;
  ssl?: {
    status?: string;
    method?: string;
    type?: string;
    validation_records?: Array<{
      txt_name?: string;
      txt_value?: string;
      cname_name?: string;
      cname_target?: string;
    }>;
  };
  ownership_verification?: {
    type?: string;
    name?: string;
    value?: string;
  };
}

@Injectable()
export class CloudflareDomainsService {
  private readonly logger = new Logger(CloudflareDomainsService.name);

  constructor(private readonly configService: ConfigService) {}

  isEnabled(): boolean {
    return this.provider === 'cloudflare' && this.zoneId.length > 0 && this.apiToken.length > 0;
  }

  async createCustomHostname(
    hostname: string,
    sslMode: 'full' | 'full_strict',
  ): Promise<{
    cloudflareHostnameId: string;
    sslStatus: 'requested' | 'issued' | 'error';
    validationRecords: CloudflareValidationRecord[];
  }> {
    const sslSettings: Record<string, unknown> = {
      min_tls_version: this.minTlsVersion,
      http2: 'on',
      tls_1_3: 'on',
    };

    if (this.tlsCiphers.length > 0) {
      sslSettings.ciphers = this.tlsCiphers;
    }

    const result = await this.request<CloudflareCustomHostnameResult>(
      `/zones/${this.zoneId}/custom_hostnames`,
      {
        method: 'POST',
        body: JSON.stringify({
          hostname,
          ssl: {
            method: this.validationMethod,
            type: 'dv',
            settings: sslSettings,
            wildcard: false,
            bundle_method: 'ubiquitous',
          },
          wait_for_ssl_pending_validation: false,
          metadata: {
            requestedSslMode: sslMode,
          },
        }),
      },
    );

    return {
      cloudflareHostnameId: result.id,
      sslStatus: this.mapSslStatus(result.ssl?.status),
      validationRecords: this.extractValidationRecords(result),
    };
  }

  async getCustomHostname(customHostnameId: string): Promise<{
    sslStatus: 'requested' | 'issued' | 'error';
    validationRecords: CloudflareValidationRecord[];
  }> {
    const result = await this.request<CloudflareCustomHostnameResult>(
      `/zones/${this.zoneId}/custom_hostnames/${encodeURIComponent(customHostnameId)}`,
      { method: 'GET' },
    );

    return {
      sslStatus: this.mapSslStatus(result.ssl?.status),
      validationRecords: this.extractValidationRecords(result),
    };
  }

  async checkReadiness(): Promise<{
    cloudflareToken: 'ok' | 'error' | 'not_configured';
    zone: 'ok' | 'error' | 'not_configured';
    customHostnamesQuota: 'ok' | 'unknown' | 'error';
    fallbackOrigin: 'unknown';
    cnameTarget: string;
    storefrontOrigin: 'configured' | 'missing';
  }> {
    if (!this.apiToken || !this.zoneId) {
      return {
        cloudflareToken: this.apiToken ? 'ok' : 'not_configured',
        zone: this.zoneId ? 'ok' : 'not_configured',
        customHostnamesQuota: 'unknown',
        fallbackOrigin: 'unknown',
        cnameTarget: this.cnameTarget,
        storefrontOrigin: this.cnameTarget.length > 0 ? 'configured' : 'missing',
      };
    }

    try {
      await this.request<unknown>(`/zones/${this.zoneId}`, { method: 'GET' });
      return {
        cloudflareToken: 'ok',
        zone: 'ok',
        customHostnamesQuota: 'unknown',
        fallbackOrigin: 'unknown',
        cnameTarget: this.cnameTarget,
        storefrontOrigin: this.cnameTarget.length > 0 ? 'configured' : 'missing',
      };
    } catch (error) {
      return {
        cloudflareToken:
          error instanceof DomainProviderException && error.code === 'CF_TOKEN_INVALID'
            ? 'error'
            : 'ok',
        zone: 'error',
        customHostnamesQuota: 'error',
        fallbackOrigin: 'unknown',
        cnameTarget: this.cnameTarget,
        storefrontOrigin: this.cnameTarget.length > 0 ? 'configured' : 'missing',
      };
    }
  }

  async deleteCustomHostname(customHostnameId: string): Promise<void> {
    try {
      await this.request<unknown>(
        `/zones/${this.zoneId}/custom_hostnames/${encodeURIComponent(customHostnameId)}`,
        { method: 'DELETE' },
      );
    } catch (error) {
      this.logger.warn(
        `Failed deleting Cloudflare custom hostname ${customHostnameId}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const response = await fetch(`${this.apiBaseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(15_000),
    });

    const envelope = (await response.json().catch(() => null)) as CloudflareApiEnvelope<T> | null;
    if (!response.ok || !envelope?.success || !envelope.result) {
      const message =
        envelope?.errors?.map((error) => error.message).join('; ') ?? response.statusText;
      throw this.toProviderException(message, response.status);
    }

    return envelope.result;
  }

  private extractValidationRecords(
    result: CloudflareCustomHostnameResult,
  ): CloudflareValidationRecord[] {
    const records: CloudflareValidationRecord[] = [];

    for (const record of result.ssl?.validation_records ?? []) {
      if (record.cname_name && record.cname_target) {
        records.push({ type: 'CNAME', name: record.cname_name, value: record.cname_target });
      }
      if (record.txt_name && record.txt_value) {
        records.push({ type: 'TXT', name: record.txt_name, value: record.txt_value });
      }
    }

    const ownership = result.ownership_verification;
    if (ownership?.name && ownership.value) {
      records.push({
        type: ownership.type?.toUpperCase() === 'CNAME' ? 'CNAME' : 'TXT',
        name: ownership.name,
        value: ownership.value,
      });
    }

    return records;
  }

  private toProviderException(message: string, status: number): DomainProviderException {
    const normalized = message.toLowerCase();
    let code: DomainProviderErrorDetails['code'] = 'CF_REQUEST_FAILED';
    let userMessage = 'تعذر تجهيز النطاق من مزود الخدمة. يرجى المحاولة لاحقا أو التواصل مع الدعم.';

    if (status === 401 || status === 403 || normalized.includes('token')) {
      code = 'CF_TOKEN_INVALID';
      userMessage = 'إعدادات النطاقات المخصصة غير مكتملة من طرف المنصة. تواصل مع الدعم.';
    } else if (status === 429 || normalized.includes('rate limit')) {
      code = 'CF_RATE_LIMIT';
      userMessage = 'مزود النطاقات مشغول حاليا. انتظر قليلا ثم أعد المحاولة.';
    } else if (normalized.includes('quota') || normalized.includes('custom hostname')) {
      code = 'CF_CUSTOM_HOSTNAME_QUOTA_MISSING';
      userMessage = 'إعدادات النطاقات المخصصة تحتاج مراجعة من الدعم.';
    } else if (normalized.includes('fallback origin')) {
      code = 'CF_FALLBACK_ORIGIN_INACTIVE';
      userMessage = 'إعدادات النطاقات المخصصة غير مكتملة من طرف المنصة. تواصل مع الدعم.';
    } else if (normalized.includes('certificate authority')) {
      code = 'CF_CERTIFICATE_AUTHORITY_NOT_ALLOWED';
      userMessage = 'إعدادات شهادة SSL تحتاج مراجعة من الدعم.';
    } else if (normalized.includes('custom_origin_sni')) {
      code = 'CF_CUSTOM_ORIGIN_SNI_NOT_ALLOWED';
      userMessage = 'إعدادات شهادة SSL تحتاج مراجعة من الدعم.';
    } else if (normalized.includes('pending')) {
      code = 'CF_VALIDATION_PENDING';
      userMessage = 'شهادة SSL قيد الإصدار. قد يستغرق ذلك من 5 إلى 30 دقيقة.';
    }

    return new DomainProviderException({
      code,
      userMessage,
      technicalMessage: `Cloudflare API request failed: ${message}`,
    });
  }

  private mapSslStatus(status: string | undefined): 'requested' | 'issued' | 'error' {
    const normalized = (status ?? '').toLowerCase();
    if (
      normalized === 'active' ||
      normalized === 'active_redeploying' ||
      normalized === 'active_renewing'
    ) {
      return 'issued';
    }

    if (
      normalized === 'pending_validation' ||
      normalized === 'pending_issuance' ||
      normalized === 'initializing' ||
      normalized === 'pending_deployment'
    ) {
      return 'requested';
    }

    return 'error';
  }

  private get provider(): string {
    return this.configService.get<string>('DOMAIN_SSL_PROVIDER', 'manual').trim().toLowerCase();
  }

  private get apiBaseUrl(): string {
    return this.configService
      .get<string>('CLOUDFLARE_API_BASE_URL', 'https://api.cloudflare.com/client/v4')
      .replace(/\/+$/, '');
  }

  private get apiToken(): string {
    return this.configService.get<string>('CLOUDFLARE_API_TOKEN', '').trim();
  }

  private get zoneId(): string {
    return this.configService.get<string>('CLOUDFLARE_ZONE_ID', '').trim();
  }

  private get validationMethod(): string {
    const configured = this.configService
      .get<string>('CLOUDFLARE_SSL_VALIDATION_METHOD', 'txt')
      .trim()
      .toLowerCase();
    return configured === 'http' ? 'http' : 'txt';
  }

  private get minTlsVersion(): string {
    const configured = this.configService.get<string>('CLOUDFLARE_MIN_TLS_VERSION', '1.2').trim();
    return configured === '1.3' ? '1.3' : '1.2';
  }

  private get tlsCiphers(): string[] {
    const configured = this.configService.get<string>('CLOUDFLARE_TLS_CIPHERS', '').trim();
    if (configured.length === 0) {
      return [];
    }

    return configured
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  private get cnameTarget(): string {
    return this.configService.get<string>('DOMAIN_CNAME_TARGET', 'stores.example.com').trim();
  }
}

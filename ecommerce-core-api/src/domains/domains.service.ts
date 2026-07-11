import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import type { RequestContextData } from '../common/utils/request-context.util';
import { OutboxService } from '../messaging/outbox.service';
import { SaasService } from '../saas/saas.service';
import {
  CloudflareDomainsService,
  DomainProviderException,
  type CloudflareValidationRecord,
} from './cloudflare-domains.service';
import {
  DomainDnsInspectorService,
  type DomainDnsRecordStatus,
} from './domain-dns-inspector.service';
import type { CreateDomainDto } from './dto/create-domain.dto';
import { DnsResolverService } from './dns-resolver.service';
import { DomainsRepository, type StoreDomainRecord } from './domains.repository';

export interface StoreDomainDnsRecordResponse {
  type: 'CNAME' | 'TXT';
  name: string;
  value: string;
  purpose: 'routing' | 'ownership' | 'ssl' | 'cloudflare_ownership';
  required: boolean;
  status: DomainDnsRecordStatus | 'pending';
}

export interface StoreDomainResponse {
  id: string;
  storeId: string;
  hostname: string;
  routingType: 'cname';
  routingHost: string;
  routingTarget: string;
  status: 'pending' | 'verified' | 'active';
  sslStatus: 'pending' | 'requested' | 'issued' | 'error';
  sslProvider: 'manual' | 'cloudflare';
  sslMode: 'full' | 'full_strict';
  sslLastCheckedAt: Date | null;
  sslError: string | null;
  verificationToken: string;
  verificationDnsHost: string;
  verifiedAt: Date | null;
  activatedAt: Date | null;
  records: StoreDomainDnsRecordResponse[];
  lastDnsCheckAt: Date | null;
  supportRequired: boolean;
  merchantStatus:
    | 'pending_dns'
    | 'verified'
    | 'issuing_ssl'
    | 'active'
    | 'dns_error'
    | 'support_required';
  rootDomainWarning: string | null;
}

export interface CompleteDomainSetupResponse extends StoreDomainResponse {
  setupComplete: boolean;
  message: string;
}

@Injectable()
export class DomainsService {
  constructor(
    private readonly domainsRepository: DomainsRepository,
    private readonly dnsResolverService: DnsResolverService,
    private readonly outboxService: OutboxService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
    private readonly saasService: SaasService,
    private readonly cloudflareDomainsService: CloudflareDomainsService,
    private readonly domainDnsInspectorService: DomainDnsInspectorService,
  ) {}

  async create(
    currentUser: AuthUser,
    input: CreateDomainDto,
    context: RequestContextData,
  ): Promise<StoreDomainResponse> {
    await this.saasService.assertFeatureEnabled(currentUser.storeId, 'custom_domains');
    await this.saasService.assertMetricCanGrow(currentUser.storeId, 'domains.total', 1);

    const verificationToken = this.generateVerificationToken();

    try {
      const created = await this.domainsRepository.create({
        storeId: currentUser.storeId,
        hostname: this.normalizeHostname(input.hostname),
        verificationToken,
        sslProvider: this.sslProvider,
        sslMode: this.sslMode,
        cloudflareZoneId: this.cloudflareZoneId,
      });

      await this.log('domains.created', currentUser, created.id, context, {
        hostname: created.hostname,
      });

      return this.toResponse(created);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Hostname is already in use');
      }
      throw error;
    }
  }

  async list(currentUser: AuthUser): Promise<StoreDomainResponse[]> {
    const domains = await this.domainsRepository.list(currentUser.storeId);
    return domains.map((domain) => this.toResponse(domain));
  }

  async verify(
    currentUser: AuthUser,
    domainId: string,
    context: RequestContextData,
  ): Promise<StoreDomainResponse> {
    const domain = await this.requireDomain(currentUser.storeId, domainId);

    if (domain.status === 'verified' || domain.status === 'active') {
      return this.toResponse(domain);
    }

    const isVerified = await this.dnsResolverService.hasVerificationRecord(
      domain.hostname,
      domain.verification_token,
      this.verificationPrefix,
    );

    if (!isVerified) {
      throw new BadRequestException('Domain verification token not found in DNS TXT records');
    }

    const verified = await this.domainsRepository.markVerified(currentUser.storeId, domain.id);
    if (!verified) {
      throw new NotFoundException('Domain not found');
    }

    await this.outboxService.enqueue({
      aggregateType: 'domain',
      aggregateId: verified.id,
      eventType: 'domain.verified',
      payload: {
        storeId: currentUser.storeId,
        domainId: verified.id,
        hostname: verified.hostname,
      },
    });

    await this.log('domains.verified', currentUser, verified.id, context, {
      hostname: verified.hostname,
    });

    return this.toResponse(verified);
  }

  async activate(
    currentUser: AuthUser,
    domainId: string,
    context: RequestContextData,
  ): Promise<StoreDomainResponse> {
    const domain = await this.requireDomain(currentUser.storeId, domainId);
    if (domain.status === 'pending') {
      throw new BadRequestException('Domain must be verified before activation');
    }

    const hasRoutingCname = await this.dnsResolverService.hasRoutingCname(
      domain.hostname,
      this.routingTarget,
    );

    if (!hasRoutingCname) {
      throw new BadRequestException(
        `Domain routing CNAME is missing. Expected ${domain.hostname} -> ${this.routingTarget}`,
      );
    }

    let nextSslStatus: 'requested' | 'issued' | 'error' = 'issued';
    let cloudflareHostnameId: string | null = domain.cloudflare_hostname_id;
    const sslError: string | null = null;

    if (domain.ssl_provider === 'cloudflare') {
      if (!this.cloudflareDomainsService.isEnabled()) {
        throw new BadRequestException(
          'Cloudflare integration is not configured. Set CLOUDFLARE_ZONE_ID and CLOUDFLARE_API_TOKEN.',
        );
      }

      try {
        if (domain.cloudflare_hostname_id) {
          const status = await this.cloudflareDomainsService.getCustomHostname(
            domain.cloudflare_hostname_id,
          );
          nextSslStatus = status.sslStatus;
        } else {
          const created = await this.cloudflareDomainsService.createCustomHostname(
            domain.hostname,
            domain.ssl_mode,
          );
          cloudflareHostnameId = created.cloudflareHostnameId;
          nextSslStatus = created.sslStatus;
        }
      } catch (error) {
        const providerError = this.toProviderError(error);
        const updated = await this.domainsRepository.markVerifiedWithSslError({
          storeId: currentUser.storeId,
          domainId: domain.id,
          sslError: providerError.userMessage,
          technicalErrorCode: providerError.code,
          technicalErrorMessage: providerError.technicalMessage,
        });
        if (!updated) {
          throw new NotFoundException('Domain not found');
        }
        return this.toResponse(updated);
      }
    }

    const activated = await this.domainsRepository.markActive({
      storeId: currentUser.storeId,
      domainId: domain.id,
      sslStatus: nextSslStatus,
      cloudflareHostnameId,
      sslError,
    });
    if (!activated) {
      throw new NotFoundException('Domain not found');
    }

    await this.outboxService.enqueue({
      aggregateType: 'domain',
      aggregateId: activated.id,
      eventType: 'domain.activated',
      payload: {
        storeId: currentUser.storeId,
        domainId: activated.id,
        hostname: activated.hostname,
        sslStatus: activated.ssl_status,
        sslError: activated.ssl_error,
      },
    });

    await this.log('domains.activated', currentUser, activated.id, context, {
      hostname: activated.hostname,
      sslStatus: activated.ssl_status,
      sslError: activated.ssl_error,
    });

    return this.toResponse(activated);
  }

  async remove(
    currentUser: AuthUser,
    domainId: string,
    context: RequestContextData,
  ): Promise<void> {
    const domain = await this.requireDomain(currentUser.storeId, domainId);

    if (
      domain.ssl_provider === 'cloudflare' &&
      domain.cloudflare_hostname_id &&
      this.cloudflareDomainsService.isEnabled()
    ) {
      await this.cloudflareDomainsService.deleteCustomHostname(domain.cloudflare_hostname_id);
    }

    const deleted = await this.domainsRepository.delete(currentUser.storeId, domainId);
    if (!deleted) {
      throw new NotFoundException('Domain not found');
    }

    await this.log('domains.deleted', currentUser, domainId, context, {});
  }

  async syncSslStatus(
    currentUser: AuthUser,
    domainId: string,
    context: RequestContextData,
  ): Promise<StoreDomainResponse> {
    const domain = await this.requireDomain(currentUser.storeId, domainId);

    if (domain.ssl_provider !== 'cloudflare') {
      return this.toResponse(domain);
    }

    if (!this.cloudflareDomainsService.isEnabled()) {
      throw new BadRequestException(
        'Cloudflare integration is not configured. Set CLOUDFLARE_ZONE_ID and CLOUDFLARE_API_TOKEN.',
      );
    }

    if (!domain.cloudflare_hostname_id) {
      if (domain.status !== 'verified' && domain.status !== 'active') {
        throw new BadRequestException(
          'لم يتم إنشاء شهادة SSL بعد. اضغط "تحقق وإكمال الربط" بعد إضافة سجلات DNS.',
        );
      }

      const hasRoutingCname = await this.dnsResolverService.hasRoutingCname(
        domain.hostname,
        this.routingTarget,
      );
      if (!hasRoutingCname) {
        throw new BadRequestException(
          `سجل CNAME غير صحيح. تأكد من توجيه ${domain.hostname} إلى ${this.routingTarget}.`,
        );
      }
    }

    let sslStatus: 'requested' | 'issued' | 'error' =
      domain.ssl_status === 'issued'
        ? 'issued'
        : domain.ssl_status === 'requested'
          ? 'requested'
          : 'error';
    let sslError: string | null = null;

    let cloudflareHostnameId = domain.cloudflare_hostname_id;
    let validationRecords: CloudflareValidationRecord[] = this.savedCloudflareRecords(domain);

    try {
      const cloudflareState = cloudflareHostnameId
        ? await this.cloudflareDomainsService.getCustomHostname(cloudflareHostnameId)
        : await this.cloudflareDomainsService.createCustomHostname(
            domain.hostname,
            domain.ssl_mode,
          );
      cloudflareHostnameId =
        'cloudflareHostnameId' in cloudflareState
          ? String(cloudflareState.cloudflareHostnameId)
          : cloudflareHostnameId;
      sslStatus = cloudflareState.sslStatus;
      validationRecords = cloudflareState.validationRecords;
    } catch (error) {
      const providerError = this.toProviderError(error);
      sslStatus = 'error';
      sslError = providerError.userMessage;
      const updated = await this.domainsRepository.updateSslState({
        storeId: currentUser.storeId,
        domainId,
        sslStatus,
        cloudflareHostnameId,
        sslError,
        technicalErrorCode: providerError.code,
        technicalErrorMessage: providerError.technicalMessage,
      });

      if (!updated) {
        throw new NotFoundException('Domain not found');
      }

      return this.toResponse(updated);
    }

    const updated = await this.domainsRepository.updateSslState({
      storeId: currentUser.storeId,
      domainId,
      sslStatus,
      cloudflareHostnameId,
      sslError,
      validationRecords,
    });

    if (!updated) {
      throw new NotFoundException('Domain not found');
    }

    await this.log('domains.ssl_synced', currentUser, domainId, context, {
      hostname: updated.hostname,
      sslStatus: updated.ssl_status,
      sslError: updated.ssl_error,
    });

    return this.toResponse(updated);
  }

  async completeSetup(
    currentUser: AuthUser,
    domainId: string,
    context: RequestContextData,
  ): Promise<CompleteDomainSetupResponse> {
    let domain = await this.requireDomain(currentUser.storeId, domainId);
    const baseRecords = this.buildDnsRecords(domain);
    const checkedRecords = await Promise.all(
      baseRecords
        .filter((record) => record.purpose === 'routing' || record.purpose === 'ownership')
        .map(async (record) => ({
          ...record,
          status: (await this.domainDnsInspectorService.checkRecord(record)).status,
        })),
    );

    await this.domainsRepository.updateDnsCheck({
      storeId: currentUser.storeId,
      domainId,
      result: checkedRecords,
    });

    const ownershipValid = checkedRecords.some(
      (record) => record.purpose === 'ownership' && record.status === 'valid',
    );
    const routingValid = checkedRecords.some(
      (record) => record.purpose === 'routing' && record.status === 'valid',
    );

    if (!ownershipValid || !routingValid) {
      return {
        ...this.toResponse(domain, checkedRecords),
        setupComplete: false,
        message: 'لم تكتمل سجلات DNS بعد. تأكد من القيم المطلوبة ثم أعد الفحص.',
      };
    }

    if (domain.status === 'pending') {
      const verified = await this.domainsRepository.markVerified(currentUser.storeId, domain.id);
      if (!verified) {
        throw new NotFoundException('Domain not found');
      }
      domain = verified;
    }

    if (domain.ssl_provider === 'manual') {
      const activated = await this.domainsRepository.markActive({
        storeId: currentUser.storeId,
        domainId: domain.id,
        sslStatus: 'issued',
        cloudflareHostnameId: null,
        sslError: null,
      });
      if (!activated) {
        throw new NotFoundException('Domain not found');
      }
      domain = activated;
    } else {
      if (!this.cloudflareDomainsService.isEnabled()) {
        const updated = await this.domainsRepository.markVerifiedWithSslError({
          storeId: currentUser.storeId,
          domainId: domain.id,
          sslError: 'إعدادات النطاقات المخصصة غير مكتملة من طرف المنصة. تواصل مع الدعم.',
          technicalErrorCode: 'CF_REQUEST_FAILED',
          technicalErrorMessage: 'Cloudflare integration is not configured',
        });
        if (!updated) {
          throw new NotFoundException('Domain not found');
        }
        return {
          ...this.toResponse(updated, checkedRecords),
          setupComplete: false,
          message: 'تم التحقق من DNS، لكن إعدادات SSL تحتاج تدخل الدعم.',
        };
      }

      try {
        const cloudflareState = domain.cloudflare_hostname_id
          ? await this.cloudflareDomainsService.getCustomHostname(domain.cloudflare_hostname_id)
          : await this.cloudflareDomainsService.createCustomHostname(
              domain.hostname,
              domain.ssl_mode,
            );

        const cloudflareHostnameId =
          'cloudflareHostnameId' in cloudflareState
            ? String(cloudflareState.cloudflareHostnameId)
            : domain.cloudflare_hostname_id;

        const activated = await this.domainsRepository.markActive({
          storeId: currentUser.storeId,
          domainId: domain.id,
          sslStatus: cloudflareState.sslStatus,
          cloudflareHostnameId,
          sslError: null,
          validationRecords: cloudflareState.validationRecords,
        });
        if (!activated) {
          throw new NotFoundException('Domain not found');
        }
        domain = activated;
      } catch (error) {
        const providerError = this.toProviderError(error);
        const updated = await this.domainsRepository.markVerifiedWithSslError({
          storeId: currentUser.storeId,
          domainId: domain.id,
          sslError: providerError.userMessage,
          technicalErrorCode: providerError.code,
          technicalErrorMessage: providerError.technicalMessage,
        });
        if (!updated) {
          throw new NotFoundException('Domain not found');
        }
        return {
          ...this.toResponse(updated, checkedRecords),
          setupComplete: false,
          message: 'تم التحقق من DNS، لكن إصدار SSL يحتاج تدخل الدعم.',
        };
      }
    }

    await this.log('domains.setup_completed', currentUser, domainId, context, {
      hostname: domain.hostname,
      sslStatus: domain.ssl_status,
    });

    return {
      ...this.toResponse(domain, checkedRecords),
      setupComplete: domain.status === 'active' && domain.ssl_status === 'issued',
      message:
        domain.ssl_status === 'issued'
          ? 'تم ربط الدومين بنجاح.'
          : 'تم التفعيل، وشهادة SSL قيد الإصدار. قد يستغرق ذلك من 5 إلى 30 دقيقة.',
    };
  }

  async syncPendingSslDomains(limit = 100): Promise<{
    checked: number;
    updated: number;
    failed: number;
  }> {
    const candidates = await this.domainsRepository.listSslSyncCandidates(limit);
    let updated = 0;
    let failed = 0;

    for (const domain of candidates) {
      try {
        await this.syncCloudflareDomainRecord(domain);
        updated += 1;
      } catch {
        failed += 1;
      }
    }

    return { checked: candidates.length, updated, failed };
  }

  private async requireDomain(storeId: string, domainId: string): Promise<StoreDomainRecord> {
    const domain = await this.domainsRepository.findById(storeId, domainId);
    if (!domain) {
      throw new NotFoundException('Domain not found');
    }
    return domain;
  }

  private async syncCloudflareDomainRecord(domain: StoreDomainRecord): Promise<void> {
    if (!this.cloudflareDomainsService.isEnabled()) {
      return;
    }

    let cloudflareHostnameId = domain.cloudflare_hostname_id;
    if (!cloudflareHostnameId) {
      const hasRoutingCname = await this.dnsResolverService.hasRoutingCname(
        domain.hostname,
        this.routingTarget,
      );
      if (!hasRoutingCname) {
        return;
      }
    }

    try {
      const cloudflareState = cloudflareHostnameId
        ? await this.cloudflareDomainsService.getCustomHostname(cloudflareHostnameId)
        : await this.cloudflareDomainsService.createCustomHostname(
            domain.hostname,
            domain.ssl_mode,
          );

      cloudflareHostnameId =
        'cloudflareHostnameId' in cloudflareState
          ? String(cloudflareState.cloudflareHostnameId)
          : cloudflareHostnameId;

      await this.domainsRepository.updateSslState({
        storeId: domain.store_id,
        domainId: domain.id,
        sslStatus: cloudflareState.sslStatus,
        cloudflareHostnameId,
        sslError: null,
        validationRecords: cloudflareState.validationRecords,
      });
    } catch (error) {
      const providerError = this.toProviderError(error);
      await this.domainsRepository.updateSslState({
        storeId: domain.store_id,
        domainId: domain.id,
        sslStatus: 'error',
        cloudflareHostnameId,
        sslError: providerError.userMessage,
        technicalErrorCode: providerError.code,
        technicalErrorMessage: providerError.technicalMessage,
      });
      throw error;
    }
  }

  private async log(
    action: string,
    currentUser: AuthUser,
    domainId: string,
    context: RequestContextData,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.auditService.log({
      action,
      storeId: currentUser.storeId,
      storeUserId: currentUser.id,
      targetType: 'store_domain',
      targetId: domainId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        ...metadata,
        ...(context.requestId ? { requestId: context.requestId } : {}),
      },
    });
  }

  private toResponse(
    domain: StoreDomainRecord,
    checkedRecords: StoreDomainDnsRecordResponse[] = [],
  ): StoreDomainResponse {
    return {
      id: domain.id,
      storeId: domain.store_id,
      hostname: domain.hostname,
      routingType: 'cname',
      routingHost: domain.hostname,
      routingTarget: this.routingTarget,
      status: domain.status,
      sslStatus: domain.ssl_status,
      sslProvider: domain.ssl_provider,
      sslMode: domain.ssl_mode,
      sslLastCheckedAt: domain.ssl_last_checked_at,
      sslError: domain.ssl_error,
      verificationToken: domain.verification_token,
      verificationDnsHost: `${this.verificationPrefix}.${domain.hostname}`,
      verifiedAt: domain.verified_at,
      activatedAt: domain.activated_at,
      records: this.buildDnsRecords(domain, checkedRecords),
      lastDnsCheckAt: domain.last_dns_check_at,
      supportRequired: domain.support_required,
      merchantStatus: this.toMerchantStatus(domain),
      rootDomainWarning: this.isLikelyRootDomain(domain.hostname)
        ? 'يبدو أنك أدخلت دومينا رئيسيا. ننصح باستخدام www أو subdomain وربط الدومين الرئيسي بتحويل إليه.'
        : null,
    };
  }

  private buildDnsRecords(
    domain: StoreDomainRecord,
    checkedRecords: StoreDomainDnsRecordResponse[] = [],
  ): StoreDomainDnsRecordResponse[] {
    const records: StoreDomainDnsRecordResponse[] = [
      {
        type: 'CNAME',
        name: domain.hostname,
        value: this.routingTarget,
        purpose: 'routing',
        required: true,
        status: domain.status === 'active' ? 'valid' : 'pending',
      },
      {
        type: 'TXT',
        name: `${this.verificationPrefix}.${domain.hostname}`,
        value: domain.verification_token,
        purpose: 'ownership',
        required: true,
        status: domain.status === 'pending' ? 'pending' : 'valid',
      },
      ...this.savedCloudflareRecords(domain).map((record) => ({
        type: record.type,
        name: record.name,
        value: record.value,
        purpose: record.name.includes('_cf-custom-hostname')
          ? ('cloudflare_ownership' as const)
          : ('ssl' as const),
        required: true,
        status: domain.ssl_status === 'issued' ? ('valid' as const) : ('pending' as const),
      })),
    ];

    return records.map((record) => {
      const checked = checkedRecords.find(
        (item) =>
          item.type === record.type && item.name === record.name && item.value === record.value,
      );
      return checked ? { ...record, status: checked.status } : record;
    });
  }

  private savedCloudflareRecords(domain: StoreDomainRecord): CloudflareValidationRecord[] {
    return Array.isArray(domain.ssl_validation_records)
      ? domain.ssl_validation_records.filter((record): record is CloudflareValidationRecord => {
          const candidate = record as Partial<CloudflareValidationRecord>;
          return (
            (candidate.type === 'CNAME' || candidate.type === 'TXT') &&
            typeof candidate.name === 'string' &&
            typeof candidate.value === 'string'
          );
        })
      : [];
  }

  private toMerchantStatus(domain: StoreDomainRecord): StoreDomainResponse['merchantStatus'] {
    if (domain.support_required || domain.ssl_status === 'error') {
      return 'support_required';
    }
    if (domain.status === 'active' && domain.ssl_status === 'issued') {
      return 'active';
    }
    if (domain.status === 'active' || domain.ssl_status === 'requested') {
      return 'issuing_ssl';
    }
    if (domain.status === 'verified') {
      return 'verified';
    }
    return 'pending_dns';
  }

  private toProviderError(error: unknown): {
    code: string;
    userMessage: string;
    technicalMessage: string;
  } {
    if (error instanceof DomainProviderException) {
      return {
        code: error.code,
        userMessage: error.userMessage,
        technicalMessage: error.technicalMessage,
      };
    }

    return {
      code: 'CF_REQUEST_FAILED',
      userMessage: 'تعذر تجهيز النطاق من مزود الخدمة. يرجى المحاولة لاحقا أو التواصل مع الدعم.',
      technicalMessage: error instanceof Error ? error.message : 'Unknown Cloudflare error',
    };
  }

  private isLikelyRootDomain(hostname: string): boolean {
    return hostname.split('.').length === 2;
  }

  private get verificationPrefix(): string {
    return this.configService.get<string>('DOMAIN_VERIFY_TXT_PREFIX', '_kaleem-verify');
  }

  private get routingTarget(): string {
    const configuredTarget = this.configService.get<string>(
      'DOMAIN_CNAME_TARGET',
      'stores.example.com',
    );
    const normalizedTarget = this.normalizeHostname(configuredTarget);
    return normalizedTarget.length > 0 ? normalizedTarget : 'stores.example.com';
  }

  private get sslMode(): 'full' | 'full_strict' {
    const configured = this.configService.get<string>('DOMAIN_SSL_MODE', 'full_strict');
    return configured === 'full' ? 'full' : 'full_strict';
  }

  private get sslProvider(): 'manual' | 'cloudflare' {
    const configured = this.configService.get<string>('DOMAIN_SSL_PROVIDER', 'manual').trim();
    return configured === 'cloudflare' ? 'cloudflare' : 'manual';
  }

  private get cloudflareZoneId(): string | null {
    const value = this.configService.get<string>('CLOUDFLARE_ZONE_ID', '').trim();
    return value.length > 0 ? value : null;
  }

  private generateVerificationToken(): string {
    return randomBytes(16).toString('hex');
  }

  private normalizeHostname(value: string): string {
    let normalized = value.trim().toLowerCase();
    normalized = normalized.replace(/^https?:\/\//, '');
    normalized = normalized.replace(/\/.*$/, '');
    return normalized.replace(/\.$/, '');
  }

  private isUniqueViolation(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const dbError = error as Error & { code?: string };
    return dbError.code === '23505';
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import type { RequestContextData } from '../../common/utils/request-context.util';
import type { ListPlatformSubscriptionsQueryDto } from '../dto/list-platform-subscriptions-query.dto';
import { SaasRepository } from '../saas.repository';
import { SaasHelpers } from './helpers';

@Injectable()
export class PlatformDomainService {
  constructor(
    private readonly saasRepository: SaasRepository,
    private readonly auditService: AuditService,
  ) {}

  async listPlatformDomains() {
    const rows = await this.saasRepository.listPlatformDomains();
    return rows.map((row) => SaasHelpers.toPlatformDomainResponse(row));
  }

  async listPlatformDomainIssues() {
    const rows = await this.saasRepository.listPlatformDomainIssues(100);
    return rows.map((row) => SaasHelpers.toPlatformDomainResponse(row));
  }

  async getPlatformDomainById(domainId: string) {
    const domain = await this.saasRepository.findPlatformDomainById(domainId);
    if (!domain) {
      throw new NotFoundException('Domain not found');
    }

    return SaasHelpers.toPlatformDomainResponse(domain);
  }

  async recheckPlatformDomain(domainId: string, context: RequestContextData) {
    const domain = await this.saasRepository.findPlatformDomainById(domainId);
    if (!domain) {
      throw new NotFoundException('Domain not found');
    }

    const touched = await this.saasRepository.touchPlatformDomainCheck(domainId);
    if (!touched) {
      throw new NotFoundException('Domain not found');
    }

    await this.auditService.log({
      action: 'platform.domain_rechecked',
      storeId: touched.store_id,
      storeUserId: null,
      targetType: 'store_domain',
      targetId: touched.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        requestId: context.requestId,
        hostname: touched.hostname,
      },
    });

    const refreshed = await this.saasRepository.findPlatformDomainById(domainId);
    if (!refreshed) {
      throw new NotFoundException('Domain not found');
    }

    return SaasHelpers.toPlatformDomainResponse(refreshed);
  }

  async forceSyncPlatformDomain(domainId: string, context: RequestContextData) {
    const domain = await this.saasRepository.findPlatformDomainById(domainId);
    if (!domain) {
      throw new NotFoundException('Domain not found');
    }

    const touched = await this.saasRepository.touchPlatformDomainCheck(domainId);
    if (!touched) {
      throw new NotFoundException('Domain not found');
    }

    await this.auditService.log({
      action: 'platform.domain_force_synced',
      storeId: domain.store_id,
      storeUserId: null,
      targetType: 'store_domain',
      targetId: domain.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        requestId: context.requestId,
        hostname: domain.hostname,
      },
    });

    const refreshed = await this.saasRepository.findPlatformDomainById(domainId);
    if (!refreshed) {
      throw new NotFoundException('Domain not found');
    }

    return SaasHelpers.toPlatformDomainResponse(refreshed);
  }

  async listPlatformSubscriptions(query: ListPlatformSubscriptionsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const result = await this.saasRepository.listPlatformSubscriptions({
      status: query.status ?? null,
      limit,
      offset: (page - 1) * limit,
    });

    return {
      items: result.rows.map((row) => ({
        id: row.id,
        storeId: row.store_id,
        storeName: row.store_name,
        storeSlug: row.store_slug,
        planCode: row.plan_code,
        planName: row.plan_name,
        status: row.status,
        startsAt: row.starts_at,
        currentPeriodEnd: row.current_period_end,
        trialEndsAt: row.trial_ends_at,
        billingCycle: row.billing_cycle,
        nextBillingAt: row.next_billing_at,
        cancelAtPeriodEnd: row.cancel_at_period_end,
      })),
      total: result.total,
      page,
      limit,
    };
  }
}

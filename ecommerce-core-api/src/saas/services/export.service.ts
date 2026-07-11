import { Injectable } from '@nestjs/common';
import type { ListPlatformStoresQueryDto } from '../dto/list-platform-stores-query.dto';
import type { ListPlatformSubscriptionsQueryDto } from '../dto/list-platform-subscriptions-query.dto';
import { SaasHelpers } from './helpers';
import { PlatformDashboardService } from './platform-dashboard.service';
import { PlatformDomainService } from './platform-domain.service';
import { PlatformOperationsService } from './platform-operations.service';
import { PlatformStoreService } from './platform-store.service';

@Injectable()
export class ExportService {
  constructor(
    private readonly platformStoreService: PlatformStoreService,
    private readonly platformDomainService: PlatformDomainService,
    private readonly platformOperationsService: PlatformOperationsService,
    private readonly platformDashboardService: PlatformDashboardService,
  ) {}

  async exportPlatformStoresCsv(query: ListPlatformStoresQueryDto) {
    const result = await this.platformStoreService.listPlatformStores({
      ...query,
      page: 1,
      limit: 100,
    });
    return SaasHelpers.toCsv(
      [
        'store id',
        'name',
        'slug',
        'status',
        'owner',
        'plan',
        'subscription status',
        'created at',
        'last activity',
      ],
      result.items.map((item) => [
        item.id,
        item.name,
        item.slug,
        item.isSuspended ? 'suspended' : 'active',
        '',
        item.planCode ?? '',
        item.subscriptionStatus ?? '',
        item.createdAt,
        '',
      ]),
    );
  }

  async exportPlatformSubscriptionsCsv(query: ListPlatformSubscriptionsQueryDto) {
    const result = await this.platformDomainService.listPlatformSubscriptions({
      ...query,
      page: 1,
      limit: 100,
    });
    return SaasHelpers.toCsv(
      ['store', 'plan', 'status', 'started at', 'current period end', 'amount'],
      result.items.map((item) => [
        item.storeName,
        item.planName,
        item.status,
        item.startsAt,
        item.currentPeriodEnd ?? '',
        '',
      ]),
    );
  }

  async exportPlatformInvoicesCsv() {
    const rows = await this.platformOperationsService.listPlatformFinanceCollections(100);
    return SaasHelpers.toCsv(
      ['invoice id', 'store', 'amount', 'currency', 'status', 'issued at', 'due at', 'paid at'],
      rows.map((item) => [
        item.invoiceId,
        item.storeName,
        item.totalAmount,
        item.currencyCode,
        item.status,
        item.updatedAt,
        item.dueAt ?? '',
        '',
      ]),
    );
  }

  async exportPlatformDomainsCsv() {
    const rows = await this.platformDomainService.listPlatformDomains();
    return SaasHelpers.toCsv(
      ['domain', 'store', 'verification status', 'ssl status', 'last checked', 'failure reason'],
      rows.map((item) => [
        item.hostname,
        item.storeName,
        item.status,
        item.sslStatus,
        item.sslLastCheckedAt ?? '',
        item.sslError ?? '',
      ]),
    );
  }

  async exportPlatformSupportCasesCsv() {
    const rows = await this.platformOperationsService.listPlatformSupportCases(100);
    return SaasHelpers.toCsv(
      ['case id', 'title', 'store', 'status', 'priority', 'assignee', 'created at', 'updated at'],
      rows.map((item) => [
        item.id,
        item.subject,
        item.storeId ?? '',
        item.status,
        item.priority,
        item.assigneeName ?? '',
        item.createdAt,
        item.updatedAt,
      ]),
    );
  }

  async exportPlatformRiskViolationsCsv() {
    const rows = await this.platformOperationsService.listPlatformRiskViolations(100);
    return SaasHelpers.toCsv(
      ['violation id', 'store', 'type', 'severity', 'status', 'created at', 'resolved at'],
      rows.map((item) => [
        item.id,
        item.storeId ?? '',
        item.category,
        item.severity,
        item.status,
        item.createdAt,
        item.resolvedAt ?? '',
      ]),
    );
  }

  async exportPlatformComplianceTasksCsv() {
    const rows = await this.platformOperationsService.listPlatformComplianceTasks(100);
    return SaasHelpers.toCsv(
      ['task id', 'policy key', 'title', 'status', 'assignee', 'due date', 'created at'],
      rows.map((item) => [
        item.id,
        item.policyKey,
        item.title,
        item.status,
        item.assigneeName ?? '',
        item.dueAt ?? '',
        item.createdAt,
      ]),
    );
  }
}

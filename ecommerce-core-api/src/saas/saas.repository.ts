import { Injectable } from '@nestjs/common';
import type { Queryable } from './repository/types';
import { PlanRepository } from './repository/plan.repository';
import { SubscriptionRepository } from './repository/subscription.repository';
import { InvoiceRepository } from './repository/invoice.repository';
import { BillingEventRepository } from './repository/billing-event.repository';
import { UsageMetricsRepository } from './repository/usage-metrics.repository';
import { PlatformStoreRepository } from './repository/platform-store.repository';
import { PlatformAdminRepository } from './repository/platform-admin.repository';
import { PlatformDashboardRepository } from './repository/platform-dashboard.repository';
import { PlatformDomainRepository } from './repository/platform-domain.repository';
import { PlatformOperationsRepository } from './repository/platform-operations.repository';
import { SubscriptionCommercialRepository } from './repository/subscription-commercial.repository';
import { SubscriptionAdjustmentRepository } from './repository/subscription-adjustment.repository';
import { SubscriptionReceiptRepository } from './repository/subscription-receipt.repository';

export type {
  Queryable,
  PlanRecord,
  PlanLimitRecord,
  PlanEntitlementRecord,
  CurrentSubscriptionRecord,
  PlatformStoreRecord,
  PlatformSubscriptionRecord,
  PlatformDomainRecord,
  PlatformDashboardSummaryRecord,
  PlatformAuditActivityRecord,
  PlatformStoreNoteRecord,
  PlatformIncidentRecord,
  PlatformAdminUserRecord,
  PlatformRoleRecord,
  PlatformSettingRecord,
  PlatformAutomationRuleRecord,
  PlatformAutomationRunRecord,
  PlatformSupportCaseRecord,
  PlatformSupportCaseEventRecord,
  PlatformRiskViolationRecord,
  PlatformComplianceTaskRecord,
  SubscriptionInvoiceRecord,
  SubscriptionPaymentRecord,
  PlatformInvoiceDetailsRecord,
  BillingEventRecord,
  SubscriptionSettingsRecord,
  SubscriptionCouponRecord,
  SubscriptionCouponRedemptionRecord,
  SubscriptionPaymentReceiptRecord,
  SubscriptionAdjustmentRecord,
} from './repository/types';

@Injectable()
export class SaasRepository {
  constructor(
    private readonly planRepo: PlanRepository,
    private readonly subscriptionRepo: SubscriptionRepository,
    private readonly invoiceRepo: InvoiceRepository,
    private readonly billingEventRepo: BillingEventRepository,
    private readonly usageMetricsRepo: UsageMetricsRepository,
    private readonly platformStoreRepo: PlatformStoreRepository,
    private readonly platformAdminRepo: PlatformAdminRepository,
    private readonly platformDashboardRepo: PlatformDashboardRepository,
    private readonly platformDomainRepo: PlatformDomainRepository,
    private readonly platformOperationsRepo: PlatformOperationsRepository,
    private readonly subscriptionCommercialRepo: SubscriptionCommercialRepository,
    private readonly subscriptionAdjustmentRepo: SubscriptionAdjustmentRepository,
    private readonly subscriptionReceiptRepo: SubscriptionReceiptRepository,
  ) {}

  async withTransaction<T>(callback: (db: Queryable) => Promise<T>): Promise<T> {
    return this.planRepo.withTransaction(callback);
  }

  async listPlans(...args: Parameters<PlanRepository['listPlans']>) {
    return this.planRepo.listPlans(...args);
  }
  async findPlanByCode(...args: Parameters<PlanRepository['findPlanByCode']>) {
    return this.planRepo.findPlanByCode(...args);
  }
  async findPlanById(...args: Parameters<PlanRepository['findPlanById']>) {
    return this.planRepo.findPlanById(...args);
  }
  async createPlan(...args: Parameters<PlanRepository['createPlan']>) {
    return this.planRepo.createPlan(...args);
  }
  async updatePlan(...args: Parameters<PlanRepository['updatePlan']>) {
    return this.planRepo.updatePlan(...args);
  }
  async setPlanActive(...args: Parameters<PlanRepository['setPlanActive']>) {
    return this.planRepo.setPlanActive(...args);
  }
  async listPlanLimits(...args: Parameters<PlanRepository['listPlanLimits']>) {
    return this.planRepo.listPlanLimits(...args);
  }
  async replacePlanLimits(...args: Parameters<PlanRepository['replacePlanLimits']>) {
    return this.planRepo.replacePlanLimits(...args);
  }
  async listPlanEntitlements(...args: Parameters<PlanRepository['listPlanEntitlements']>) {
    return this.planRepo.listPlanEntitlements(...args);
  }
  async replacePlanEntitlements(...args: Parameters<PlanRepository['replacePlanEntitlements']>) {
    return this.planRepo.replacePlanEntitlements(...args);
  }

  async getCurrentSubscription(
    ...args: Parameters<SubscriptionRepository['getCurrentSubscription']>
  ) {
    return this.subscriptionRepo.getCurrentSubscription(...args);
  }
  async getCurrentSubscriptionForUpdate(
    ...args: Parameters<SubscriptionRepository['getCurrentSubscriptionForUpdate']>
  ) {
    return this.subscriptionRepo.getCurrentSubscriptionForUpdate(...args);
  }
  async replaceCurrentSubscription(
    ...args: Parameters<SubscriptionRepository['replaceCurrentSubscription']>
  ) {
    return this.subscriptionRepo.replaceCurrentSubscription(...args);
  }
  async updateCurrentSubscriptionBilling(
    ...args: Parameters<SubscriptionRepository['updateCurrentSubscriptionBilling']>
  ) {
    return this.subscriptionRepo.updateCurrentSubscriptionBilling(...args);
  }
  async findSubscriptionById(...args: Parameters<SubscriptionRepository['findSubscriptionById']>) {
    return this.subscriptionRepo.findSubscriptionById(...args);
  }
  async findCurrentSubscriptionByProviderSubscriptionId(
    ...args: Parameters<SubscriptionRepository['findCurrentSubscriptionByProviderSubscriptionId']>
  ) {
    return this.subscriptionRepo.findCurrentSubscriptionByProviderSubscriptionId(...args);
  }
  async updateSubscriptionStatus(
    ...args: Parameters<SubscriptionRepository['updateSubscriptionStatus']>
  ) {
    return this.subscriptionRepo.updateSubscriptionStatus(...args);
  }

  async getSubscriptionSettings(
    ...args: Parameters<SubscriptionCommercialRepository['getSettings']>
  ) {
    return this.subscriptionCommercialRepo.getSettings(...args);
  }
  async updateSubscriptionSettings(
    ...args: Parameters<SubscriptionCommercialRepository['updateSettings']>
  ) {
    return this.subscriptionCommercialRepo.updateSettings(...args);
  }
  async hasStoreUsedTrial(
    ...args: Parameters<SubscriptionCommercialRepository['hasStoreUsedTrial']>
  ) {
    return this.subscriptionCommercialRepo.hasStoreUsedTrial(...args);
  }
  async hasOwnerUsedTrial(
    ...args: Parameters<SubscriptionCommercialRepository['hasOwnerUsedTrial']>
  ) {
    return this.subscriptionCommercialRepo.hasOwnerUsedTrial(...args);
  }
  async listExpiredTrials(
    ...args: Parameters<SubscriptionCommercialRepository['listExpiredTrials']>
  ) {
    return this.subscriptionCommercialRepo.listExpiredTrials(...args);
  }
  async listSubscriptionCoupons(
    ...args: Parameters<SubscriptionCommercialRepository['listCoupons']>
  ) {
    return this.subscriptionCommercialRepo.listCoupons(...args);
  }
  async findSubscriptionCouponById(
    ...args: Parameters<SubscriptionCommercialRepository['findCouponById']>
  ) {
    return this.subscriptionCommercialRepo.findCouponById(...args);
  }
  async findSubscriptionCouponByCode(
    ...args: Parameters<SubscriptionCommercialRepository['findCouponByCode']>
  ) {
    return this.subscriptionCommercialRepo.findCouponByCode(...args);
  }
  async createSubscriptionCoupon(
    ...args: Parameters<SubscriptionCommercialRepository['createCoupon']>
  ) {
    return this.subscriptionCommercialRepo.createCoupon(...args);
  }
  async updateSubscriptionCoupon(
    ...args: Parameters<SubscriptionCommercialRepository['updateCoupon']>
  ) {
    return this.subscriptionCommercialRepo.updateCoupon(...args);
  }
  async countSubscriptionCouponRedemptionsForStore(
    ...args: Parameters<SubscriptionCommercialRepository['countCouponRedemptionsForStore']>
  ) {
    return this.subscriptionCommercialRepo.countCouponRedemptionsForStore(...args);
  }
  async createSubscriptionCouponRedemption(
    ...args: Parameters<SubscriptionCommercialRepository['createCouponRedemption']>
  ) {
    return this.subscriptionCommercialRepo.createCouponRedemption(...args);
  }
  async listSubscriptionCouponRedemptions(
    ...args: Parameters<SubscriptionCommercialRepository['listCouponRedemptions']>
  ) {
    return this.subscriptionCommercialRepo.listCouponRedemptions(...args);
  }
  async listSubscriptionCouponRedemptionsByStore(
    ...args: Parameters<SubscriptionCommercialRepository['listCouponRedemptionsByStore']>
  ) {
    return this.subscriptionCommercialRepo.listCouponRedemptionsByStore(...args);
  }
  async getSubscriptionAnalytics(
    ...args: Parameters<SubscriptionCommercialRepository['getSubscriptionAnalytics']>
  ) {
    return this.subscriptionCommercialRepo.getSubscriptionAnalytics(...args);
  }

  async createSubscriptionReceipt(
    ...args: Parameters<SubscriptionReceiptRepository['createReceipt']>
  ) {
    return this.subscriptionReceiptRepo.createReceipt(...args);
  }
  async listSubscriptionReceipts(
    ...args: Parameters<SubscriptionReceiptRepository['listReceipts']>
  ) {
    return this.subscriptionReceiptRepo.listReceipts(...args);
  }
  async findSubscriptionReceiptById(
    ...args: Parameters<SubscriptionReceiptRepository['findReceiptById']>
  ) {
    return this.subscriptionReceiptRepo.findReceiptById(...args);
  }
  async findSubscriptionReceiptByIdForUpdate(
    ...args: Parameters<SubscriptionReceiptRepository['findReceiptByIdForUpdate']>
  ) {
    return this.subscriptionReceiptRepo.findReceiptByIdForUpdate(...args);
  }
  async findSubscriptionInvoiceForUpdate(
    ...args: Parameters<SubscriptionReceiptRepository['findInvoiceForUpdate']>
  ) {
    return this.subscriptionReceiptRepo.findInvoiceForUpdate(...args);
  }
  async hasApprovedSubscriptionReceiptForInvoice(
    ...args: Parameters<SubscriptionReceiptRepository['hasApprovedReceiptForInvoice']>
  ) {
    return this.subscriptionReceiptRepo.hasApprovedReceiptForInvoice(...args);
  }
  async hasPendingSubscriptionReceiptForInvoice(
    ...args: Parameters<SubscriptionReceiptRepository['hasPendingReceiptForInvoice']>
  ) {
    return this.subscriptionReceiptRepo.hasPendingReceiptForInvoice(...args);
  }
  async findSubscriptionReceiptMediaAsset(
    ...args: Parameters<SubscriptionReceiptRepository['findReceiptMediaAsset']>
  ) {
    return this.subscriptionReceiptRepo.findReceiptMediaAsset(...args);
  }
  async markSubscriptionReceiptReviewed(
    ...args: Parameters<SubscriptionReceiptRepository['markReceiptReviewed']>
  ) {
    return this.subscriptionReceiptRepo.markReceiptReviewed(...args);
  }

  async createInvoice(...args: Parameters<InvoiceRepository['createInvoice']>) {
    return this.invoiceRepo.createInvoice(...args);
  }
  async findInvoiceById(...args: Parameters<InvoiceRepository['findInvoiceById']>) {
    return this.invoiceRepo.findInvoiceById(...args);
  }
  async findInvoiceByExternalInvoiceId(
    ...args: Parameters<InvoiceRepository['findInvoiceByExternalInvoiceId']>
  ) {
    return this.invoiceRepo.findInvoiceByExternalInvoiceId(...args);
  }
  async updateInvoiceStatus(...args: Parameters<InvoiceRepository['updateInvoiceStatus']>) {
    return this.invoiceRepo.updateInvoiceStatus(...args);
  }
  async listInvoicesByStore(...args: Parameters<InvoiceRepository['listInvoicesByStore']>) {
    return this.invoiceRepo.listInvoicesByStore(...args);
  }
  async createPayment(...args: Parameters<InvoiceRepository['createPayment']>) {
    return this.invoiceRepo.createPayment(...args);
  }
  async findPlatformInvoiceDetailsById(
    ...args: Parameters<InvoiceRepository['findPlatformInvoiceDetailsById']>
  ) {
    return this.invoiceRepo.findPlatformInvoiceDetailsById(...args);
  }
  async listPaymentsByInvoice(...args: Parameters<InvoiceRepository['listPaymentsByInvoice']>) {
    return this.invoiceRepo.listPaymentsByInvoice(...args);
  }
  async listPaymentsByStore(...args: Parameters<InvoiceRepository['listPaymentsByStore']>) {
    return this.invoiceRepo.listPaymentsByStore(...args);
  }

  async findBillingEventBySourceAndIdempotency(
    ...args: Parameters<BillingEventRepository['findBillingEventBySourceAndIdempotency']>
  ) {
    return this.billingEventRepo.findBillingEventBySourceAndIdempotency(...args);
  }
  async createBillingEvent(...args: Parameters<BillingEventRepository['createBillingEvent']>) {
    return this.billingEventRepo.createBillingEvent(...args);
  }
  async updateBillingEventStatus(
    ...args: Parameters<BillingEventRepository['updateBillingEventStatus']>
  ) {
    return this.billingEventRepo.updateBillingEventStatus(...args);
  }
  async listRecentBillingEvents(
    ...args: Parameters<BillingEventRepository['listRecentBillingEvents']>
  ) {
    return this.billingEventRepo.listRecentBillingEvents(...args);
  }

  async recordUsageEvent(...args: Parameters<UsageMetricsRepository['recordUsageEvent']>) {
    return this.usageMetricsRepo.recordUsageEvent(...args);
  }
  async countProducts(...args: Parameters<UsageMetricsRepository['countProducts']>) {
    return this.usageMetricsRepo.countProducts(...args);
  }
  async countStaff(...args: Parameters<UsageMetricsRepository['countStaff']>) {
    return this.usageMetricsRepo.countStaff(...args);
  }
  async countOrdersForMonth(...args: Parameters<UsageMetricsRepository['countOrdersForMonth']>) {
    return this.usageMetricsRepo.countOrdersForMonth(...args);
  }
  async countDomains(...args: Parameters<UsageMetricsRepository['countDomains']>) {
    return this.usageMetricsRepo.countDomains(...args);
  }
  async getStorageUsedBytes(...args: Parameters<UsageMetricsRepository['getStorageUsedBytes']>) {
    return this.usageMetricsRepo.getStorageUsedBytes(...args);
  }
  async countApiCallsForMonth(
    ...args: Parameters<UsageMetricsRepository['countApiCallsForMonth']>
  ) {
    return this.usageMetricsRepo.countApiCallsForMonth(...args);
  }
  async countWebhooksForMonth(
    ...args: Parameters<UsageMetricsRepository['countWebhooksForMonth']>
  ) {
    return this.usageMetricsRepo.countWebhooksForMonth(...args);
  }
  async pingPostgres(...args: Parameters<UsageMetricsRepository['pingPostgres']>) {
    return this.usageMetricsRepo.pingPostgres(...args);
  }
  async pingRedis(...args: Parameters<UsageMetricsRepository['pingRedis']>) {
    return this.usageMetricsRepo.pingRedis(...args);
  }

  async findPlatformStoreById(
    ...args: Parameters<PlatformStoreRepository['findPlatformStoreById']>
  ) {
    return this.platformStoreRepo.findPlatformStoreById(...args);
  }
  async findPlatformStoreByIdForUpdate(
    ...args: Parameters<PlatformStoreRepository['findPlatformStoreByIdForUpdate']>
  ) {
    return this.platformStoreRepo.findPlatformStoreByIdForUpdate(...args);
  }
  async listPlatformStores(...args: Parameters<PlatformStoreRepository['listPlatformStores']>) {
    return this.platformStoreRepo.listPlatformStores(...args);
  }
  async setStoreSuspension(...args: Parameters<PlatformStoreRepository['setStoreSuspension']>) {
    return this.platformStoreRepo.setStoreSuspension(...args);
  }
  async isStoreSuspended(...args: Parameters<PlatformStoreRepository['isStoreSuspended']>) {
    return this.platformStoreRepo.isStoreSuspended(...args);
  }
  async getStoreDeletionPreview(
    ...args: Parameters<PlatformStoreRepository['getStoreDeletionPreview']>
  ) {
    return this.platformStoreRepo.getStoreDeletionPreview(...args);
  }
  async markStoreDeleted(...args: Parameters<PlatformStoreRepository['markStoreDeleted']>) {
    return this.platformStoreRepo.markStoreDeleted(...args);
  }
  async anonymizeStoreUsers(...args: Parameters<PlatformStoreRepository['anonymizeStoreUsers']>) {
    return this.platformStoreRepo.anonymizeStoreUsers(...args);
  }
  async revokeStoreSessions(...args: Parameters<PlatformStoreRepository['revokeStoreSessions']>) {
    return this.platformStoreRepo.revokeStoreSessions(...args);
  }
  async disableStoreDomains(...args: Parameters<PlatformStoreRepository['disableStoreDomains']>) {
    return this.platformStoreRepo.disableStoreDomains(...args);
  }
  async createStoreDeletionPurgeJob(
    ...args: Parameters<PlatformStoreRepository['createStoreDeletionPurgeJob']>
  ) {
    return this.platformStoreRepo.createStoreDeletionPurgeJob(...args);
  }
  async getStoreDeletionStatus(
    ...args: Parameters<PlatformStoreRepository['getStoreDeletionStatus']>
  ) {
    return this.platformStoreRepo.getStoreDeletionStatus(...args);
  }
  async retryStoreDeletionPurge(
    ...args: Parameters<PlatformStoreRepository['retryStoreDeletionPurge']>
  ) {
    return this.platformStoreRepo.retryStoreDeletionPurge(...args);
  }
  async listStoreAuditActivity(
    ...args: Parameters<PlatformStoreRepository['listStoreAuditActivity']>
  ) {
    return this.platformStoreRepo.listStoreAuditActivity(...args);
  }
  async listStoreNotes(...args: Parameters<PlatformStoreRepository['listStoreNotes']>) {
    return this.platformStoreRepo.listStoreNotes(...args);
  }
  async createStoreNote(...args: Parameters<PlatformStoreRepository['createStoreNote']>) {
    return this.platformStoreRepo.createStoreNote(...args);
  }
  async listAuditLogsByTarget(
    ...args: Parameters<PlatformStoreRepository['listAuditLogsByTarget']>
  ) {
    return this.platformStoreRepo.listAuditLogsByTarget(...args);
  }

  async listPlatformAdmins(...args: Parameters<PlatformAdminRepository['listPlatformAdmins']>) {
    return this.platformAdminRepo.listPlatformAdmins(...args);
  }
  async findPlatformAdminByEmail(
    ...args: Parameters<PlatformAdminRepository['findPlatformAdminByEmail']>
  ) {
    return this.platformAdminRepo.findPlatformAdminByEmail(...args);
  }
  async findPlatformAdminById(
    ...args: Parameters<PlatformAdminRepository['findPlatformAdminById']>
  ) {
    return this.platformAdminRepo.findPlatformAdminById(...args);
  }
  async createPlatformAdmin(...args: Parameters<PlatformAdminRepository['createPlatformAdmin']>) {
    return this.platformAdminRepo.createPlatformAdmin(...args);
  }
  async updatePlatformAdmin(...args: Parameters<PlatformAdminRepository['updatePlatformAdmin']>) {
    return this.platformAdminRepo.updatePlatformAdmin(...args);
  }
  async listPlatformRolePermissions(
    ...args: Parameters<PlatformAdminRepository['listPlatformRolePermissions']>
  ) {
    return this.platformAdminRepo.listPlatformRolePermissions(...args);
  }
  async listPlatformRoles(...args: Parameters<PlatformAdminRepository['listPlatformRoles']>) {
    return this.platformAdminRepo.listPlatformRoles(...args);
  }
  async findPlatformRoleById(...args: Parameters<PlatformAdminRepository['findPlatformRoleById']>) {
    return this.platformAdminRepo.findPlatformRoleById(...args);
  }
  async findPlatformRoleByCode(
    ...args: Parameters<PlatformAdminRepository['findPlatformRoleByCode']>
  ) {
    return this.platformAdminRepo.findPlatformRoleByCode(...args);
  }
  async createPlatformRole(...args: Parameters<PlatformAdminRepository['createPlatformRole']>) {
    return this.platformAdminRepo.createPlatformRole(...args);
  }
  async updatePlatformRole(...args: Parameters<PlatformAdminRepository['updatePlatformRole']>) {
    return this.platformAdminRepo.updatePlatformRole(...args);
  }
  async replacePlatformRolePermissions(
    ...args: Parameters<PlatformAdminRepository['replacePlatformRolePermissions']>
  ) {
    return this.platformAdminRepo.replacePlatformRolePermissions(...args);
  }
  async countActiveAdminsWithRoleCode(
    ...args: Parameters<PlatformAdminRepository['countActiveAdminsWithRoleCode']>
  ) {
    return this.platformAdminRepo.countActiveAdminsWithRoleCode(...args);
  }
  async countActiveAdminsWithAnyRoleCode(
    ...args: Parameters<PlatformAdminRepository['countActiveAdminsWithAnyRoleCode']>
  ) {
    return this.platformAdminRepo.countActiveAdminsWithAnyRoleCode(...args);
  }
  async listPlatformRoleCodesByIds(
    ...args: Parameters<PlatformAdminRepository['listPlatformRoleCodesByIds']>
  ) {
    return this.platformAdminRepo.listPlatformRoleCodesByIds(...args);
  }
  async revokeAllPlatformAdminSessions(
    ...args: Parameters<PlatformAdminRepository['revokeAllPlatformAdminSessions']>
  ) {
    return this.platformAdminRepo.revokeAllPlatformAdminSessions(...args);
  }
  async assignPlatformRoleToAdmin(
    ...args: Parameters<PlatformAdminRepository['assignPlatformRoleToAdmin']>
  ) {
    return this.platformAdminRepo.assignPlatformRoleToAdmin(...args);
  }
  async replacePlatformAdminRoles(
    ...args: Parameters<PlatformAdminRepository['replacePlatformAdminRoles']>
  ) {
    return this.platformAdminRepo.replacePlatformAdminRoles(...args);
  }
  async listPlatformAdminRoleIds(
    ...args: Parameters<PlatformAdminRepository['listPlatformAdminRoleIds']>
  ) {
    return this.platformAdminRepo.listPlatformAdminRoleIds(...args);
  }
  async listPlatformAdminRoleCodes(
    ...args: Parameters<PlatformAdminRepository['listPlatformAdminRoleCodes']>
  ) {
    return this.platformAdminRepo.listPlatformAdminRoleCodes(...args);
  }
  async listPlatformPermissionKeys(
    ...args: Parameters<PlatformAdminRepository['listPlatformPermissionKeys']>
  ) {
    return this.platformAdminRepo.listPlatformPermissionKeys(...args);
  }
  async listPlatformSettings(...args: Parameters<PlatformAdminRepository['listPlatformSettings']>) {
    return this.platformAdminRepo.listPlatformSettings(...args);
  }
  async upsertPlatformSetting(
    ...args: Parameters<PlatformAdminRepository['upsertPlatformSetting']>
  ) {
    return this.platformAdminRepo.upsertPlatformSetting(...args);
  }

  async getPlatformDashboardSummary(
    ...args: Parameters<PlatformDashboardRepository['getPlatformDashboardSummary']>
  ) {
    return this.platformDashboardRepo.getPlatformDashboardSummary(...args);
  }
  async getPlatformGrowthSummary(
    ...args: Parameters<PlatformDashboardRepository['getPlatformGrowthSummary']>
  ) {
    return this.platformDashboardRepo.getPlatformGrowthSummary(...args);
  }
  async getPlatformMrrChurnSummary(
    ...args: Parameters<PlatformDashboardRepository['getPlatformMrrChurnSummary']>
  ) {
    return this.platformDashboardRepo.getPlatformMrrChurnSummary(...args);
  }
  async getPlatformCohorts(...args: Parameters<PlatformDashboardRepository['getPlatformCohorts']>) {
    return this.platformDashboardRepo.getPlatformCohorts(...args);
  }
  async getPlatformFunnelSummary(
    ...args: Parameters<PlatformDashboardRepository['getPlatformFunnelSummary']>
  ) {
    return this.platformDashboardRepo.getPlatformFunnelSummary(...args);
  }
  async listPlatformDashboardAlerts(
    ...args: Parameters<PlatformDashboardRepository['listPlatformDashboardAlerts']>
  ) {
    return this.platformDashboardRepo.listPlatformDashboardAlerts(...args);
  }
  async listRecentPlatformAuditActivity(
    ...args: Parameters<PlatformDashboardRepository['listRecentPlatformAuditActivity']>
  ) {
    return this.platformDashboardRepo.listRecentPlatformAuditActivity(...args);
  }
  async listPlatformAuditLogs(
    ...args: Parameters<PlatformDashboardRepository['listPlatformAuditLogs']>
  ) {
    return this.platformDashboardRepo.listPlatformAuditLogs(...args);
  }
  async listPlatformQueueOverview(
    ...args: Parameters<PlatformDashboardRepository['listPlatformQueueOverview']>
  ) {
    return this.platformDashboardRepo.listPlatformQueueOverview(...args);
  }

  async listPlatformDomains(...args: Parameters<PlatformDomainRepository['listPlatformDomains']>) {
    return this.platformDomainRepo.listPlatformDomains(...args);
  }
  async listPlatformDomainIssues(
    ...args: Parameters<PlatformDomainRepository['listPlatformDomainIssues']>
  ) {
    return this.platformDomainRepo.listPlatformDomainIssues(...args);
  }
  async findPlatformDomainById(
    ...args: Parameters<PlatformDomainRepository['findPlatformDomainById']>
  ) {
    return this.platformDomainRepo.findPlatformDomainById(...args);
  }
  async listPlatformDomainsByStore(
    ...args: Parameters<PlatformDomainRepository['listPlatformDomainsByStore']>
  ) {
    return this.platformDomainRepo.listPlatformDomainsByStore(...args);
  }
  async touchPlatformDomainCheck(
    ...args: Parameters<PlatformDomainRepository['touchPlatformDomainCheck']>
  ) {
    return this.platformDomainRepo.touchPlatformDomainCheck(...args);
  }

  async listPlatformIncidents(
    ...args: Parameters<PlatformOperationsRepository['listPlatformIncidents']>
  ) {
    return this.platformOperationsRepo.listPlatformIncidents(...args);
  }
  async createPlatformIncident(
    ...args: Parameters<PlatformOperationsRepository['createPlatformIncident']>
  ) {
    return this.platformOperationsRepo.createPlatformIncident(...args);
  }
  async updateIncidentStatus(
    ...args: Parameters<PlatformOperationsRepository['updateIncidentStatus']>
  ) {
    return this.platformOperationsRepo.updateIncidentStatus(...args);
  }
  async listPlatformAutomationRules(
    ...args: Parameters<PlatformOperationsRepository['listPlatformAutomationRules']>
  ) {
    return this.platformOperationsRepo.listPlatformAutomationRules(...args);
  }
  async createPlatformAutomationRule(
    ...args: Parameters<PlatformOperationsRepository['createPlatformAutomationRule']>
  ) {
    return this.platformOperationsRepo.createPlatformAutomationRule(...args);
  }
  async findPlatformAutomationRuleById(
    ...args: Parameters<PlatformOperationsRepository['findPlatformAutomationRuleById']>
  ) {
    return this.platformOperationsRepo.findPlatformAutomationRuleById(...args);
  }
  async setPlatformAutomationRuleStatus(
    ...args: Parameters<PlatformOperationsRepository['setPlatformAutomationRuleStatus']>
  ) {
    return this.platformOperationsRepo.setPlatformAutomationRuleStatus(...args);
  }
  async createPlatformAutomationRun(
    ...args: Parameters<PlatformOperationsRepository['createPlatformAutomationRun']>
  ) {
    return this.platformOperationsRepo.createPlatformAutomationRun(...args);
  }
  async updatePlatformAutomationRun(
    ...args: Parameters<PlatformOperationsRepository['updatePlatformAutomationRun']>
  ) {
    return this.platformOperationsRepo.updatePlatformAutomationRun(...args);
  }
  async listPlatformAutomationRuns(
    ...args: Parameters<PlatformOperationsRepository['listPlatformAutomationRuns']>
  ) {
    return this.platformOperationsRepo.listPlatformAutomationRuns(...args);
  }
  async listPlatformSupportCases(
    ...args: Parameters<PlatformOperationsRepository['listPlatformSupportCases']>
  ) {
    return this.platformOperationsRepo.listPlatformSupportCases(...args);
  }
  async findPlatformSupportCaseById(
    ...args: Parameters<PlatformOperationsRepository['findPlatformSupportCaseById']>
  ) {
    return this.platformOperationsRepo.findPlatformSupportCaseById(...args);
  }
  async createPlatformSupportCase(
    ...args: Parameters<PlatformOperationsRepository['createPlatformSupportCase']>
  ) {
    return this.platformOperationsRepo.createPlatformSupportCase(...args);
  }
  async updatePlatformSupportCase(
    ...args: Parameters<PlatformOperationsRepository['updatePlatformSupportCase']>
  ) {
    return this.platformOperationsRepo.updatePlatformSupportCase(...args);
  }
  async createPlatformSupportCaseEvent(
    ...args: Parameters<PlatformOperationsRepository['createPlatformSupportCaseEvent']>
  ) {
    return this.platformOperationsRepo.createPlatformSupportCaseEvent(...args);
  }
  async listPlatformSupportCaseEvents(
    ...args: Parameters<PlatformOperationsRepository['listPlatformSupportCaseEvents']>
  ) {
    return this.platformOperationsRepo.listPlatformSupportCaseEvents(...args);
  }
  async listPlatformRiskViolations(
    ...args: Parameters<PlatformOperationsRepository['listPlatformRiskViolations']>
  ) {
    return this.platformOperationsRepo.listPlatformRiskViolations(...args);
  }
  async findPlatformRiskViolationById(
    ...args: Parameters<PlatformOperationsRepository['findPlatformRiskViolationById']>
  ) {
    return this.platformOperationsRepo.findPlatformRiskViolationById(...args);
  }
  async createPlatformRiskViolation(
    ...args: Parameters<PlatformOperationsRepository['createPlatformRiskViolation']>
  ) {
    return this.platformOperationsRepo.createPlatformRiskViolation(...args);
  }
  async updatePlatformRiskViolationStatus(
    ...args: Parameters<PlatformOperationsRepository['updatePlatformRiskViolationStatus']>
  ) {
    return this.platformOperationsRepo.updatePlatformRiskViolationStatus(...args);
  }
  async mergePlatformRiskViolationDetails(
    ...args: Parameters<PlatformOperationsRepository['mergePlatformRiskViolationDetails']>
  ) {
    return this.platformOperationsRepo.mergePlatformRiskViolationDetails(...args);
  }
  async listPlatformComplianceTasks(
    ...args: Parameters<PlatformOperationsRepository['listPlatformComplianceTasks']>
  ) {
    return this.platformOperationsRepo.listPlatformComplianceTasks(...args);
  }
  async findPlatformComplianceTaskById(
    ...args: Parameters<PlatformOperationsRepository['findPlatformComplianceTaskById']>
  ) {
    return this.platformOperationsRepo.findPlatformComplianceTaskById(...args);
  }
  async createPlatformComplianceTask(
    ...args: Parameters<PlatformOperationsRepository['createPlatformComplianceTask']>
  ) {
    return this.platformOperationsRepo.createPlatformComplianceTask(...args);
  }
  async updatePlatformComplianceTaskStatus(
    ...args: Parameters<PlatformOperationsRepository['updatePlatformComplianceTaskStatus']>
  ) {
    return this.platformOperationsRepo.updatePlatformComplianceTaskStatus(...args);
  }
  async updatePlatformComplianceTaskJson(
    ...args: Parameters<PlatformOperationsRepository['updatePlatformComplianceTaskJson']>
  ) {
    return this.platformOperationsRepo.updatePlatformComplianceTaskJson(...args);
  }
  async getPlatformFinanceOverview(
    ...args: Parameters<PlatformOperationsRepository['getPlatformFinanceOverview']>
  ) {
    return this.platformOperationsRepo.getPlatformFinanceOverview(...args);
  }
  async getBillingSubscriptionsOverview(
    ...args: Parameters<PlatformOperationsRepository['getBillingSubscriptionsOverview']>
  ) {
    return this.platformOperationsRepo.getBillingSubscriptionsOverview(...args);
  }
  async getBillingReportSummary(
    ...args: Parameters<PlatformOperationsRepository['getBillingReportSummary']>
  ) {
    return this.platformOperationsRepo.getBillingReportSummary(...args);
  }
  async listPlatformFinanceAging(
    ...args: Parameters<PlatformOperationsRepository['listPlatformFinanceAging']>
  ) {
    return this.platformOperationsRepo.listPlatformFinanceAging(...args);
  }
  async listPlatformFinanceCollections(
    ...args: Parameters<PlatformOperationsRepository['listPlatformFinanceCollections']>
  ) {
    return this.platformOperationsRepo.listPlatformFinanceCollections(...args);
  }
  async listOnboardingPipeline(
    ...args: Parameters<PlatformOperationsRepository['listOnboardingPipeline']>
  ) {
    return this.platformOperationsRepo.listOnboardingPipeline(...args);
  }
  async listOnboardingStuckStores(
    ...args: Parameters<PlatformOperationsRepository['listOnboardingStuckStores']>
  ) {
    return this.platformOperationsRepo.listOnboardingStuckStores(...args);
  }
  async listPlatformSubscriptions(
    ...args: Parameters<PlatformOperationsRepository['listPlatformSubscriptions']>
  ) {
    return this.platformOperationsRepo.listPlatformSubscriptions(...args);
  }
  async createSubscriptionAdjustment(
    ...args: Parameters<SubscriptionAdjustmentRepository['createAdjustment']>
  ) {
    return this.subscriptionAdjustmentRepo.createAdjustment(...args);
  }
  async listSubscriptionAdjustmentsByStore(
    ...args: Parameters<SubscriptionAdjustmentRepository['listAdjustmentsByStore']>
  ) {
    return this.subscriptionAdjustmentRepo.listAdjustmentsByStore(...args);
  }
  async listSubscriptionAdjustmentsBySubscription(
    ...args: Parameters<SubscriptionAdjustmentRepository['listAdjustmentsBySubscription']>
  ) {
    return this.subscriptionAdjustmentRepo.listAdjustmentsBySubscription(...args);
  }
  async getSubscriptionAdjustmentById(
    ...args: Parameters<SubscriptionAdjustmentRepository['getAdjustmentById']>
  ) {
    return this.subscriptionAdjustmentRepo.getAdjustmentById(...args);
  }
}

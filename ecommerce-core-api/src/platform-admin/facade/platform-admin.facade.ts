import { Injectable } from '@nestjs/common';
import { PlatformAnalyticsService } from '../core/services/platform-analytics.service';
import { PlatformAuditService } from '../core/services/platform-audit.service';
import { PlatformDashboardService } from '../core/services/platform-dashboard.service';
import { PlatformDomainsService } from '../core/services/platform-domains.service';
import { PlatformHealthService } from '../core/services/platform-health.service';
import { PlatformNotesService } from '../core/services/platform-notes.service';
import { PlatformOnboardingService } from '../core/services/platform-onboarding.service';
import { PlatformStoresService } from '../core/services/platform-stores.service';
import { PlatformFinanceService } from '../billing/services/platform-finance.service';
import { PlatformInvoicesService } from '../billing/services/platform-invoices.service';
import { PlatformPlansService } from '../billing/services/platform-plans.service';
import { PlatformSubscriptionsService } from '../billing/services/platform-subscriptions.service';
import { PlatformAdminsService } from '../operations/services/platform-admins.service';
import { PlatformAutomationService } from '../operations/services/platform-automation.service';
import { PlatformComplianceService } from '../operations/services/platform-compliance.service';
import { PlatformRiskService } from '../operations/services/platform-risk.service';
import { PlatformRolesService } from '../operations/services/platform-roles.service';
import { PlatformSettingsService } from '../operations/services/platform-settings.service';
import { PlatformSupportService } from '../operations/services/platform-support.service';

@Injectable()
export class PlatformAdminFacade {
  constructor(
    private readonly platformDashboardService: PlatformDashboardService,
    private readonly platformStoresService: PlatformStoresService,
    private readonly platformDomainsService: PlatformDomainsService,
    private readonly platformHealthService: PlatformHealthService,
    private readonly platformAnalyticsService: PlatformAnalyticsService,
    private readonly platformAuditService: PlatformAuditService,
    private readonly platformOnboardingService: PlatformOnboardingService,
    private readonly platformNotesService: PlatformNotesService,
    private readonly platformAdminsService: PlatformAdminsService,
    private readonly platformRolesService: PlatformRolesService,
    private readonly platformSettingsService: PlatformSettingsService,
    private readonly platformAutomationService: PlatformAutomationService,
    private readonly platformSupportService: PlatformSupportService,
    private readonly platformRiskService: PlatformRiskService,
    private readonly platformComplianceService: PlatformComplianceService,
    private readonly platformPlansService: PlatformPlansService,
    private readonly platformSubscriptionsService: PlatformSubscriptionsService,
    private readonly platformFinanceService: PlatformFinanceService,
    private readonly platformInvoicesService: PlatformInvoicesService,
  ) {}

  getPlatformDashboardSummary(
    ...args: Parameters<PlatformDashboardService['getPlatformDashboardSummary']>
  ): ReturnType<PlatformDashboardService['getPlatformDashboardSummary']> {
    return this.platformDashboardService.getPlatformDashboardSummary(...args);
  }

  getPlatformDashboardAlerts(
    ...args: Parameters<PlatformDashboardService['getPlatformDashboardAlerts']>
  ): ReturnType<PlatformDashboardService['getPlatformDashboardAlerts']> {
    return this.platformDashboardService.getPlatformDashboardAlerts(...args);
  }

  getPlatformDashboardActivity(
    ...args: Parameters<PlatformDashboardService['getPlatformDashboardActivity']>
  ): ReturnType<PlatformDashboardService['getPlatformDashboardActivity']> {
    return this.platformDashboardService.getPlatformDashboardActivity(...args);
  }

  getPlatformDashboardGrowth(
    ...args: Parameters<PlatformDashboardService['getPlatformDashboardGrowth']>
  ): ReturnType<PlatformDashboardService['getPlatformDashboardGrowth']> {
    return this.platformDashboardService.getPlatformDashboardGrowth(...args);
  }

  listPlatformStores(
    ...args: Parameters<PlatformStoresService['listPlatformStores']>
  ): ReturnType<PlatformStoresService['listPlatformStores']> {
    return this.platformStoresService.listPlatformStores(...args);
  }

  getPlatformStoreById(
    ...args: Parameters<PlatformStoresService['getPlatformStoreById']>
  ): ReturnType<PlatformStoresService['getPlatformStoreById']> {
    return this.platformStoresService.getPlatformStoreById(...args);
  }

  getPlatformStoreUsage(
    ...args: Parameters<PlatformStoresService['getPlatformStoreUsage']>
  ): ReturnType<PlatformStoresService['getPlatformStoreUsage']> {
    return this.platformStoresService.getPlatformStoreUsage(...args);
  }

  getPlatformStoreActivity(
    ...args: Parameters<PlatformStoresService['getPlatformStoreActivity']>
  ): ReturnType<PlatformStoresService['getPlatformStoreActivity']> {
    return this.platformStoresService.getPlatformStoreActivity(...args);
  }

  getPlatformStoreDomains(
    ...args: Parameters<PlatformDomainsService['getPlatformStoreDomains']>
  ): ReturnType<PlatformDomainsService['getPlatformStoreDomains']> {
    return this.platformDomainsService.getPlatformStoreDomains(...args);
  }

  getPlatformStoreSubscription(
    ...args: Parameters<PlatformStoresService['getPlatformStoreSubscription']>
  ): ReturnType<PlatformStoresService['getPlatformStoreSubscription']> {
    return this.platformStoresService.getPlatformStoreSubscription(...args);
  }

  getPlatformStore360(
    ...args: Parameters<PlatformStoresService['getPlatformStore360']>
  ): ReturnType<PlatformStoresService['getPlatformStore360']> {
    return this.platformStoresService.getPlatformStore360(...args);
  }

  updateStoreSuspension(
    ...args: Parameters<PlatformStoresService['updateStoreSuspension']>
  ): ReturnType<PlatformStoresService['updateStoreSuspension']> {
    return this.platformStoresService.updateStoreSuspension(...args);
  }

  previewStoreDeletion(
    ...args: Parameters<PlatformStoresService['previewStoreDeletion']>
  ): ReturnType<PlatformStoresService['previewStoreDeletion']> {
    return this.platformStoresService.previewStoreDeletion(...args);
  }

  confirmStoreDeletion(
    ...args: Parameters<PlatformStoresService['confirmStoreDeletion']>
  ): ReturnType<PlatformStoresService['confirmStoreDeletion']> {
    return this.platformStoresService.confirmStoreDeletion(...args);
  }

  getStoreDeletionStatus(
    ...args: Parameters<PlatformStoresService['getStoreDeletionStatus']>
  ): ReturnType<PlatformStoresService['getStoreDeletionStatus']> {
    return this.platformStoresService.getStoreDeletionStatus(...args);
  }

  retryStorePurge(
    ...args: Parameters<PlatformStoresService['retryStorePurge']>
  ): ReturnType<PlatformStoresService['retryStorePurge']> {
    return this.platformStoresService.retryStorePurge(...args);
  }

  listPlatformDomains(
    ...args: Parameters<PlatformDomainsService['listPlatformDomains']>
  ): ReturnType<PlatformDomainsService['listPlatformDomains']> {
    return this.platformDomainsService.listPlatformDomains(...args);
  }

  listPlatformDomainIssues(
    ...args: Parameters<PlatformDomainsService['listPlatformDomainIssues']>
  ): ReturnType<PlatformDomainsService['listPlatformDomainIssues']> {
    return this.platformDomainsService.listPlatformDomainIssues(...args);
  }

  getPlatformDomainById(
    ...args: Parameters<PlatformDomainsService['getPlatformDomainById']>
  ): ReturnType<PlatformDomainsService['getPlatformDomainById']> {
    return this.platformDomainsService.getPlatformDomainById(...args);
  }

  recheckPlatformDomain(
    ...args: Parameters<PlatformDomainsService['recheckPlatformDomain']>
  ): ReturnType<PlatformDomainsService['recheckPlatformDomain']> {
    return this.platformDomainsService.recheckPlatformDomain(...args);
  }

  forceSyncPlatformDomain(
    ...args: Parameters<PlatformDomainsService['forceSyncPlatformDomain']>
  ): ReturnType<PlatformDomainsService['forceSyncPlatformDomain']> {
    return this.platformDomainsService.forceSyncPlatformDomain(...args);
  }

  listPlatformAuditLogs(
    ...args: Parameters<PlatformAuditService['listPlatformAuditLogs']>
  ): ReturnType<PlatformAuditService['listPlatformAuditLogs']> {
    return this.platformAuditService.listPlatformAuditLogs(...args);
  }

  getPlatformHealthSummary(
    ...args: Parameters<PlatformHealthService['getPlatformHealthSummary']>
  ): ReturnType<PlatformHealthService['getPlatformHealthSummary']> {
    return this.platformHealthService.getPlatformHealthSummary(...args);
  }

  getPlatformHealthQueues(
    ...args: Parameters<PlatformHealthService['getPlatformHealthQueues']>
  ): ReturnType<PlatformHealthService['getPlatformHealthQueues']> {
    return this.platformHealthService.getPlatformHealthQueues(...args);
  }

  listPlatformIncidents(
    ...args: Parameters<PlatformHealthService['listPlatformIncidents']>
  ): ReturnType<PlatformHealthService['listPlatformIncidents']> {
    return this.platformHealthService.listPlatformIncidents(...args);
  }

  createPlatformIncident(
    ...args: Parameters<PlatformHealthService['createPlatformIncident']>
  ): ReturnType<PlatformHealthService['createPlatformIncident']> {
    return this.platformHealthService.createPlatformIncident(...args);
  }

  updatePlatformIncidentStatus(
    ...args: Parameters<PlatformHealthService['updatePlatformIncidentStatus']>
  ): ReturnType<PlatformHealthService['updatePlatformIncidentStatus']> {
    return this.platformHealthService.updatePlatformIncidentStatus(...args);
  }

  getPlatformOnboardingPipeline(
    ...args: Parameters<PlatformOnboardingService['getPlatformOnboardingPipeline']>
  ): ReturnType<PlatformOnboardingService['getPlatformOnboardingPipeline']> {
    return this.platformOnboardingService.getPlatformOnboardingPipeline(...args);
  }

  getPlatformOnboardingStuckStores(
    ...args: Parameters<PlatformOnboardingService['getPlatformOnboardingStuckStores']>
  ): ReturnType<PlatformOnboardingService['getPlatformOnboardingStuckStores']> {
    return this.platformOnboardingService.getPlatformOnboardingStuckStores(...args);
  }

  listPlatformStoreNotes(
    ...args: Parameters<PlatformNotesService['listPlatformStoreNotes']>
  ): ReturnType<PlatformNotesService['listPlatformStoreNotes']> {
    return this.platformNotesService.listPlatformStoreNotes(...args);
  }

  createPlatformStoreNote(
    ...args: Parameters<PlatformNotesService['createPlatformStoreNote']>
  ): ReturnType<PlatformNotesService['createPlatformStoreNote']> {
    return this.platformNotesService.createPlatformStoreNote(...args);
  }

  getPlatformAnalyticsOverview(
    ...args: Parameters<PlatformAnalyticsService['getPlatformAnalyticsOverview']>
  ): ReturnType<PlatformAnalyticsService['getPlatformAnalyticsOverview']> {
    return this.platformAnalyticsService.getPlatformAnalyticsOverview(...args);
  }

  getPlatformAnalyticsMrrChurn(
    ...args: Parameters<PlatformAnalyticsService['getPlatformAnalyticsMrrChurn']>
  ): ReturnType<PlatformAnalyticsService['getPlatformAnalyticsMrrChurn']> {
    return this.platformAnalyticsService.getPlatformAnalyticsMrrChurn(...args);
  }

  getPlatformAnalyticsCohorts(
    ...args: Parameters<PlatformAnalyticsService['getPlatformAnalyticsCohorts']>
  ): ReturnType<PlatformAnalyticsService['getPlatformAnalyticsCohorts']> {
    return this.platformAnalyticsService.getPlatformAnalyticsCohorts(...args);
  }

  getPlatformAnalyticsFunnel(
    ...args: Parameters<PlatformAnalyticsService['getPlatformAnalyticsFunnel']>
  ): ReturnType<PlatformAnalyticsService['getPlatformAnalyticsFunnel']> {
    return this.platformAnalyticsService.getPlatformAnalyticsFunnel(...args);
  }

  listPlatformAdmins(
    ...args: Parameters<PlatformAdminsService['listPlatformAdmins']>
  ): ReturnType<PlatformAdminsService['listPlatformAdmins']> {
    return this.platformAdminsService.listPlatformAdmins(...args);
  }

  createPlatformAdmin(
    ...args: Parameters<PlatformAdminsService['createPlatformAdmin']>
  ): ReturnType<PlatformAdminsService['createPlatformAdmin']> {
    return this.platformAdminsService.createPlatformAdmin(...args);
  }

  updatePlatformAdmin(
    ...args: Parameters<PlatformAdminsService['updatePlatformAdmin']>
  ): ReturnType<PlatformAdminsService['updatePlatformAdmin']> {
    return this.platformAdminsService.updatePlatformAdmin(...args);
  }

  listPlatformRoles(
    ...args: Parameters<PlatformRolesService['listPlatformRoles']>
  ): ReturnType<PlatformRolesService['listPlatformRoles']> {
    return this.platformRolesService.listPlatformRoles(...args);
  }

  createPlatformRole(
    ...args: Parameters<PlatformRolesService['createPlatformRole']>
  ): ReturnType<PlatformRolesService['createPlatformRole']> {
    return this.platformRolesService.createPlatformRole(...args);
  }

  updatePlatformRole(
    ...args: Parameters<PlatformRolesService['updatePlatformRole']>
  ): ReturnType<PlatformRolesService['updatePlatformRole']> {
    return this.platformRolesService.updatePlatformRole(...args);
  }

  getPlatformSettings(
    ...args: Parameters<PlatformSettingsService['getPlatformSettings']>
  ): ReturnType<PlatformSettingsService['getPlatformSettings']> {
    return this.platformSettingsService.getPlatformSettings(...args);
  }

  updatePlatformSettings(
    ...args: Parameters<PlatformSettingsService['updatePlatformSettings']>
  ): ReturnType<PlatformSettingsService['updatePlatformSettings']> {
    return this.platformSettingsService.updatePlatformSettings(...args);
  }

  listPlatformAutomationRules(
    ...args: Parameters<PlatformAutomationService['listPlatformAutomationRules']>
  ): ReturnType<PlatformAutomationService['listPlatformAutomationRules']> {
    return this.platformAutomationService.listPlatformAutomationRules(...args);
  }

  createPlatformAutomationRule(
    ...args: Parameters<PlatformAutomationService['createPlatformAutomationRule']>
  ): ReturnType<PlatformAutomationService['createPlatformAutomationRule']> {
    return this.platformAutomationService.createPlatformAutomationRule(...args);
  }

  updatePlatformAutomationRuleStatus(
    ...args: Parameters<PlatformAutomationService['updatePlatformAutomationRuleStatus']>
  ): ReturnType<PlatformAutomationService['updatePlatformAutomationRuleStatus']> {
    return this.platformAutomationService.updatePlatformAutomationRuleStatus(...args);
  }

  triggerPlatformAutomationRule(
    ...args: Parameters<PlatformAutomationService['triggerPlatformAutomationRule']>
  ): ReturnType<PlatformAutomationService['triggerPlatformAutomationRule']> {
    return this.platformAutomationService.triggerPlatformAutomationRule(...args);
  }

  listPlatformAutomationRuns(
    ...args: Parameters<PlatformAutomationService['listPlatformAutomationRuns']>
  ): ReturnType<PlatformAutomationService['listPlatformAutomationRuns']> {
    return this.platformAutomationService.listPlatformAutomationRuns(...args);
  }

  listPlatformSupportCases(
    ...args: Parameters<PlatformSupportService['listPlatformSupportCases']>
  ): ReturnType<PlatformSupportService['listPlatformSupportCases']> {
    return this.platformSupportService.listPlatformSupportCases(...args);
  }

  createPlatformSupportCase(
    ...args: Parameters<PlatformSupportService['createPlatformSupportCase']>
  ): ReturnType<PlatformSupportService['createPlatformSupportCase']> {
    return this.platformSupportService.createPlatformSupportCase(...args);
  }

  updatePlatformSupportCase(
    ...args: Parameters<PlatformSupportService['updatePlatformSupportCase']>
  ): ReturnType<PlatformSupportService['updatePlatformSupportCase']> {
    return this.platformSupportService.updatePlatformSupportCase(...args);
  }

  listPlatformRiskViolations(
    ...args: Parameters<PlatformRiskService['listPlatformRiskViolations']>
  ): ReturnType<PlatformRiskService['listPlatformRiskViolations']> {
    return this.platformRiskService.listPlatformRiskViolations(...args);
  }

  createPlatformRiskViolation(
    ...args: Parameters<PlatformRiskService['createPlatformRiskViolation']>
  ): ReturnType<PlatformRiskService['createPlatformRiskViolation']> {
    return this.platformRiskService.createPlatformRiskViolation(...args);
  }

  updatePlatformRiskViolationStatus(
    ...args: Parameters<PlatformRiskService['updatePlatformRiskViolationStatus']>
  ): ReturnType<PlatformRiskService['updatePlatformRiskViolationStatus']> {
    return this.platformRiskService.updatePlatformRiskViolationStatus(...args);
  }

  listPlatformComplianceTasks(
    ...args: Parameters<PlatformComplianceService['listPlatformComplianceTasks']>
  ): ReturnType<PlatformComplianceService['listPlatformComplianceTasks']> {
    return this.platformComplianceService.listPlatformComplianceTasks(...args);
  }

  createPlatformComplianceTask(
    ...args: Parameters<PlatformComplianceService['createPlatformComplianceTask']>
  ): ReturnType<PlatformComplianceService['createPlatformComplianceTask']> {
    return this.platformComplianceService.createPlatformComplianceTask(...args);
  }

  updatePlatformComplianceTaskStatus(
    ...args: Parameters<PlatformComplianceService['updatePlatformComplianceTaskStatus']>
  ): ReturnType<PlatformComplianceService['updatePlatformComplianceTaskStatus']> {
    return this.platformComplianceService.updatePlatformComplianceTaskStatus(...args);
  }

  listPlans(
    ...args: Parameters<PlatformPlansService['listPlans']>
  ): ReturnType<PlatformPlansService['listPlans']> {
    return this.platformPlansService.listPlans(...args);
  }

  createPlan(
    ...args: Parameters<PlatformPlansService['createPlan']>
  ): ReturnType<PlatformPlansService['createPlan']> {
    return this.platformPlansService.createPlan(...args);
  }

  updatePlan(
    ...args: Parameters<PlatformPlansService['updatePlan']>
  ): ReturnType<PlatformPlansService['updatePlan']> {
    return this.platformPlansService.updatePlan(...args);
  }

  archivePlan(
    ...args: Parameters<PlatformPlansService['archivePlan']>
  ): ReturnType<PlatformPlansService['archivePlan']> {
    return this.platformPlansService.archivePlan(...args);
  }

  duplicatePlan(
    ...args: Parameters<PlatformPlansService['duplicatePlan']>
  ): ReturnType<PlatformPlansService['duplicatePlan']> {
    return this.platformPlansService.duplicatePlan(...args);
  }

  assignStorePlan(
    ...args: Parameters<PlatformSubscriptionsService['assignStorePlan']>
  ): ReturnType<PlatformSubscriptionsService['assignStorePlan']> {
    return this.platformSubscriptionsService.assignStorePlan(...args);
  }

  listPlatformSubscriptions(
    ...args: Parameters<PlatformSubscriptionsService['listPlatformSubscriptions']>
  ): ReturnType<PlatformSubscriptionsService['listPlatformSubscriptions']> {
    return this.platformSubscriptionsService.listPlatformSubscriptions(...args);
  }

  cancelSubscription(
    ...args: Parameters<PlatformSubscriptionsService['cancelSubscription']>
  ): ReturnType<PlatformSubscriptionsService['cancelSubscription']> {
    return this.platformSubscriptionsService.cancelSubscription(...args);
  }

  suspendSubscription(
    ...args: Parameters<PlatformSubscriptionsService['suspendSubscription']>
  ): ReturnType<PlatformSubscriptionsService['suspendSubscription']> {
    return this.platformSubscriptionsService.suspendSubscription(...args);
  }

  resumeSubscription(
    ...args: Parameters<PlatformSubscriptionsService['resumeSubscription']>
  ): ReturnType<PlatformSubscriptionsService['resumeSubscription']> {
    return this.platformSubscriptionsService.resumeSubscription(...args);
  }

  canDowngradePlan(
    ...args: Parameters<PlatformSubscriptionsService['canDowngradePlan']>
  ): ReturnType<PlatformSubscriptionsService['canDowngradePlan']> {
    return this.platformSubscriptionsService.canDowngradePlan(...args);
  }

  settleInvoice(
    ...args: Parameters<PlatformInvoicesService['settleInvoice']>
  ): ReturnType<PlatformInvoicesService['settleInvoice']> {
    return this.platformInvoicesService.settleInvoice(...args);
  }

  getPlatformFinanceOverview(
    ...args: Parameters<PlatformFinanceService['getPlatformFinanceOverview']>
  ): ReturnType<PlatformFinanceService['getPlatformFinanceOverview']> {
    return this.platformFinanceService.getPlatformFinanceOverview(...args);
  }

  listPlatformFinanceAging(
    ...args: Parameters<PlatformFinanceService['listPlatformFinanceAging']>
  ): ReturnType<PlatformFinanceService['listPlatformFinanceAging']> {
    return this.platformFinanceService.listPlatformFinanceAging(...args);
  }

  listPlatformFinanceCollections(
    ...args: Parameters<PlatformFinanceService['listPlatformFinanceCollections']>
  ): ReturnType<PlatformFinanceService['listPlatformFinanceCollections']> {
    return this.platformFinanceService.listPlatformFinanceCollections(...args);
  }

  listPlatformBillingEvents(
    ...args: Parameters<PlatformFinanceService['listPlatformBillingEvents']>
  ): ReturnType<PlatformFinanceService['listPlatformBillingEvents']> {
    return this.platformFinanceService.listPlatformBillingEvents(...args);
  }
}

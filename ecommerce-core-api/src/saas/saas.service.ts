import { Injectable, Logger } from '@nestjs/common';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import type { RequestContextData } from '../common/utils/request-context.util';
import type { PlatformAdminUser } from '../platform/interfaces/platform-admin-user.interface';
import type { SaasFeatureKey, SaasMetricKey } from './constants/saas-metrics.constants';
import type { AssignStorePlanDto } from './dto/assign-store-plan.dto';
import type { AdjustSubscriptionDto } from './dto/adjust-subscription.dto';
import type { CancelSubscriptionDto } from './dto/cancel-subscription.dto';
import type { ChangeSubscriptionPlanDto } from './dto/change-subscription-plan.dto';
import type { CreatePlanDto } from './dto/create-plan.dto';
import type { CreatePlatformAdminDto } from './dto/create-platform-admin.dto';
import type { ConfirmStoreDeletionDto } from './dto/confirm-store-deletion.dto';
import type { CreatePlatformAutomationRuleDto } from './dto/create-platform-automation-rule.dto';
import type { CreatePlatformComplianceTaskDto } from './dto/create-platform-compliance-task.dto';
import type { CreatePlatformIncidentDto } from './dto/create-platform-incident.dto';
import type { CreatePlatformRiskViolationDto } from './dto/create-platform-risk-violation.dto';
import type { CreatePlatformRoleDto } from './dto/create-platform-role.dto';
import type { CreatePlatformSupportCaseDto } from './dto/create-platform-support-case.dto';
import type { CreateStoreNoteDto } from './dto/create-store-note.dto';
import type { ListPlatformStoresQueryDto } from './dto/list-platform-stores-query.dto';
import type { ListPlatformSubscriptionsQueryDto } from './dto/list-platform-subscriptions-query.dto';
import type { ListSubscriptionReceiptsQueryDto } from './dto/list-subscription-receipts-query.dto';
import type { ListSubscriptionInvoicesQueryDto } from './dto/list-subscription-invoices-query.dto';
import type { ListSubscriptionAdjustmentsQueryDto } from './dto/list-subscription-adjustments-query.dto';
import type { PlatformInternalCommentDto } from './dto/platform-internal-comment.dto';
import type { PlatformInvoiceNoteDto } from './dto/platform-invoice-note.dto';
import type { ProviderWebhookDto } from './dto/provider-webhook.dto';
import type { ReviewSubscriptionReceiptDto } from './dto/review-subscription-receipt.dto';
import type { RetryStorePurgeDto } from './dto/retry-store-purge.dto';
import type { SettleInvoiceDto } from './dto/settle-invoice.dto';
import type {
  UpsertSubscriptionCouponDto,
  ValidateSubscriptionCouponDto,
} from './dto/subscription-coupon.dto';
import type { UpdatePlanDto } from './dto/update-plan.dto';
import type { UpdatePlatformAdminDto } from './dto/update-platform-admin.dto';
import type { UpdatePlatformAutomationRuleStatusDto } from './dto/update-platform-automation-rule-status.dto';
import type { UpdatePlatformComplianceTaskStatusDto } from './dto/update-platform-compliance-task-status.dto';
import type { UpdatePlatformIncidentStatusDto } from './dto/update-platform-incident-status.dto';
import type { UpdatePlatformRiskViolationStatusDto } from './dto/update-platform-risk-violation-status.dto';
import type { UpdatePlatformRoleDto } from './dto/update-platform-role.dto';
import type { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';
import type { UpdatePlatformSupportCaseDto } from './dto/update-platform-support-case.dto';
import type { UpdateStoreSuspensionDto } from './dto/update-store-suspension.dto';
import type { UpdateSubscriptionSettingsDto } from './dto/update-subscription-settings.dto';
import type { TriggerPlatformAutomationRuleDto } from './dto/trigger-platform-automation-rule.dto';
import type { UploadSubscriptionReceiptDto } from './dto/upload-subscription-receipt.dto';
import type { VoidInvoiceDto } from './dto/void-invoice.dto';
import type {
  CapabilityCatalogResponse,
  InvoiceResponse,
  PlanResponse,
  StoreSubscriptionResponse,
} from './services/types';
export type {
  CapabilityCatalogResponse,
  InvoiceResponse,
  PlanResponse,
  StoreSubscriptionResponse,
} from './services/types';
import { SubscriptionService } from './services/subscription.service';
import { FeatureEnforcementService } from './services/feature-enforcement.service';
import { PlanService } from './services/plan.service';
import { BillingService } from './services/billing.service';
import { PlatformStoreService } from './services/platform-store.service';
import { PlatformAdminService } from './services/platform-admin.service';
import { PlatformDashboardService } from './services/platform-dashboard.service';
import { PlatformDomainService } from './services/platform-domain.service';
import { PlatformOperationsService } from './services/platform-operations.service';
import { ExportService } from './services/export.service';
import { SubscriptionAdjustmentService } from './services/subscription-adjustment.service';

@Injectable()
export class SaasService {
  private readonly logger = new Logger(SaasService.name);

  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly featureEnforcementService: FeatureEnforcementService,
    private readonly planService: PlanService,
    private readonly billingService: BillingService,
    private readonly platformStoreService: PlatformStoreService,
    private readonly platformAdminService: PlatformAdminService,
    private readonly platformDashboardService: PlatformDashboardService,
    private readonly platformDomainService: PlatformDomainService,
    private readonly platformOperationsService: PlatformOperationsService,
    private readonly exportService: ExportService,
    private readonly subscriptionAdjustmentService: SubscriptionAdjustmentService,
  ) {}

  async ensureDefaultSubscription(storeId: string, ownerId?: string): Promise<void> {
    return this.subscriptionService.ensureDefaultSubscription(storeId, ownerId);
  }
  async getCurrentStoreSubscription(currentUser: AuthUser): Promise<StoreSubscriptionResponse> {
    return this.subscriptionService.getCurrentStoreSubscription(currentUser);
  }
  async getMerchantBillingCenter(currentUser: AuthUser) {
    return this.subscriptionService.getMerchantBillingCenter(currentUser);
  }
  async listStoreAvailablePlans(): Promise<PlanResponse[]> {
    return this.subscriptionService.listStoreAvailablePlans();
  }
  async getSubscriptionSettings() {
    return this.subscriptionService.getSubscriptionSettings();
  }
  async updateSubscriptionSettings(input: UpdateSubscriptionSettingsDto) {
    return this.subscriptionService.updateSubscriptionSettings(input);
  }
  async processExpiredTrials(limit?: number) {
    return this.subscriptionService.processExpiredTrials(limit);
  }
  async listSubscriptionCoupons() {
    return this.subscriptionService.listSubscriptionCoupons();
  }
  async getSubscriptionCoupon(couponId: string) {
    return this.subscriptionService.getSubscriptionCoupon(couponId);
  }
  async createSubscriptionCoupon(input: UpsertSubscriptionCouponDto) {
    return this.subscriptionService.createSubscriptionCoupon(input);
  }
  async updateSubscriptionCoupon(couponId: string, input: UpsertSubscriptionCouponDto) {
    return this.subscriptionService.updateSubscriptionCoupon(couponId, input);
  }
  async disableSubscriptionCoupon(couponId: string) {
    return this.subscriptionService.disableSubscriptionCoupon(couponId);
  }
  async listSubscriptionCouponRedemptions(couponId: string) {
    return this.subscriptionService.listSubscriptionCouponRedemptions(couponId);
  }
  async validateSubscriptionCoupon(currentUser: AuthUser, input: ValidateSubscriptionCouponDto) {
    return this.subscriptionService.validateSubscriptionCoupon(currentUser, input);
  }
  async redeemSubscriptionCoupon(
    currentUser: AuthUser,
    input: ValidateSubscriptionCouponDto,
    context: RequestContextData,
  ) {
    return this.subscriptionService.redeemSubscriptionCoupon(currentUser, input, context);
  }
  async uploadSubscriptionReceipt(
    currentUser: AuthUser,
    input: UploadSubscriptionReceiptDto,
    context: RequestContextData,
  ) {
    return this.subscriptionService.uploadSubscriptionReceipt(currentUser, input, context);
  }
  async listStoreSubscriptionReceipts(
    currentUser: AuthUser,
    query: ListSubscriptionReceiptsQueryDto,
  ) {
    return this.subscriptionService.listStoreSubscriptionReceipts(currentUser, query);
  }
  async listPlatformSubscriptionReceipts(query: ListSubscriptionReceiptsQueryDto) {
    return this.subscriptionService.listPlatformSubscriptionReceipts(query);
  }
  async reviewSubscriptionReceipt(
    receiptId: string,
    input: ReviewSubscriptionReceiptDto,
    admin: PlatformAdminUser,
    context: RequestContextData,
  ) {
    return this.subscriptionService.reviewSubscriptionReceipt(receiptId, input, admin, context);
  }
  async getSubscriptionAnalytics() {
    return this.subscriptionService.getSubscriptionAnalytics();
  }
  async assignStorePlan(
    storeId: string,
    input: AssignStorePlanDto,
    context: RequestContextData,
  ): Promise<StoreSubscriptionResponse> {
    return this.subscriptionService.assignStorePlan(storeId, input, context);
  }
  async changeCurrentStorePlan(
    currentUser: AuthUser,
    input: ChangeSubscriptionPlanDto,
    context: RequestContextData,
    mode: 'upgrade' | 'downgrade',
  ): Promise<{ subscription: StoreSubscriptionResponse; invoice: InvoiceResponse | null }> {
    return this.subscriptionService.changeCurrentStorePlan(currentUser, input, context, mode);
  }
  async cancelSubscription(
    storeId: string,
    context: RequestContextData,
  ): Promise<StoreSubscriptionResponse> {
    return this.subscriptionService.cancelSubscription(storeId, context);
  }
  async requestMerchantCancellation(
    currentUser: AuthUser,
    input: CancelSubscriptionDto,
    context: RequestContextData,
  ): Promise<StoreSubscriptionResponse> {
    return this.subscriptionService.requestMerchantCancellation(currentUser, input, context);
  }
  async suspendSubscription(
    storeId: string,
    reason: string | null,
    context: RequestContextData,
  ): Promise<StoreSubscriptionResponse> {
    return this.subscriptionService.suspendSubscription(storeId, reason, context);
  }
  async resumeSubscription(
    storeId: string,
    context: RequestContextData,
  ): Promise<StoreSubscriptionResponse> {
    return this.subscriptionService.resumeSubscription(storeId, context);
  }
  async canDowngradePlan(
    storeId: string,
    targetPlanCode: string,
  ): Promise<{
    canDowngrade: boolean;
    conflicts: Array<{ metricKey: string; displayName: string; used: number; limit: number }>;
  }> {
    return this.subscriptionService.canDowngradePlan(storeId, targetPlanCode);
  }
  async assertStoreIsActive(storeId: string): Promise<void> {
    return this.subscriptionService.assertStoreIsActive(storeId);
  }
  async adjustStoreSubscription(
    storeId: string,
    input: AdjustSubscriptionDto,
    currentUser: PlatformAdminUser,
    context: RequestContextData,
  ) {
    return this.subscriptionAdjustmentService.adjustStoreSubscription(
      storeId,
      input,
      currentUser,
      context,
    );
  }
  async listStoreSubscriptionAdjustments(
    storeId: string,
    query: ListSubscriptionAdjustmentsQueryDto,
  ) {
    return this.subscriptionAdjustmentService.listStoreAdjustments(storeId, query);
  }
  async listSubscriptionAdjustments(
    subscriptionId: string,
    query: ListSubscriptionAdjustmentsQueryDto,
  ) {
    return this.subscriptionAdjustmentService.listSubscriptionAdjustments(subscriptionId, query);
  }

  async assertFeatureEnabled(storeId: string, featureKey: SaasFeatureKey): Promise<void> {
    return this.featureEnforcementService.assertFeatureEnabled(storeId, featureKey);
  }
  async isFeatureEnabled(storeId: string, featureKey: SaasFeatureKey): Promise<boolean> {
    return this.featureEnforcementService.isFeatureEnabled(storeId, featureKey);
  }
  async assertMetricCanGrow(
    storeId: string,
    metricKey: SaasMetricKey,
    increment = 1,
  ): Promise<void> {
    return this.featureEnforcementService.assertMetricCanGrow(storeId, metricKey, increment);
  }
  getCapabilityCatalog(): CapabilityCatalogResponse {
    return this.featureEnforcementService.getCapabilityCatalog();
  }
  async recordUsageEvent(
    storeId: string,
    metricKey: SaasMetricKey,
    quantity: number,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    return this.featureEnforcementService.recordUsageEvent(storeId, metricKey, quantity, metadata);
  }

  async listPlans(): Promise<PlanResponse[]> {
    return this.planService.listPlans();
  }
  async createPlan(input: CreatePlanDto): Promise<PlanResponse> {
    return this.planService.createPlan(input);
  }
  async updatePlan(planId: string, input: UpdatePlanDto): Promise<PlanResponse> {
    return this.planService.updatePlan(planId, input);
  }
  async archivePlan(planId: string, context: RequestContextData): Promise<PlanResponse> {
    return this.planService.archivePlan(planId, context);
  }
  async duplicatePlan(planId: string, context: RequestContextData): Promise<PlanResponse> {
    return this.planService.duplicatePlan(planId, context);
  }

  async listStoreInvoices(currentUser: AuthUser, query: ListSubscriptionInvoicesQueryDto) {
    return this.billingService.listStoreInvoices(currentUser, query);
  }
  async settleInvoice(
    invoiceId: string,
    input: SettleInvoiceDto,
    context: RequestContextData,
  ): Promise<InvoiceResponse> {
    return this.billingService.settleInvoice(invoiceId, input, context);
  }
  async getPlatformInvoiceById(invoiceId: string) {
    return this.billingService.getPlatformInvoiceById(invoiceId);
  }
  async addPlatformInvoiceNote(
    invoiceId: string,
    input: PlatformInvoiceNoteDto,
    currentUser: PlatformAdminUser,
    context: RequestContextData,
  ) {
    return this.billingService.addPlatformInvoiceNote(invoiceId, input, currentUser, context);
  }
  async voidPlatformInvoice(invoiceId: string, input: VoidInvoiceDto, context: RequestContextData) {
    return this.billingService.voidPlatformInvoice(invoiceId, input, context);
  }
  async handleProviderWebhook(
    input: ProviderWebhookDto,
  ): Promise<{ processed: boolean; reason?: string }> {
    return this.billingService.handleProviderWebhook(input);
  }
  async listPlatformBillingEvents(limit = 50) {
    return this.billingService.listPlatformBillingEvents(limit);
  }

  async listPlatformStores(query: ListPlatformStoresQueryDto) {
    return this.platformStoreService.listPlatformStores(query);
  }
  async getPlatformStoreById(storeId: string) {
    return this.platformStoreService.getPlatformStoreById(storeId);
  }
  async getPlatformStoreUsage(storeId: string) {
    return this.platformStoreService.getPlatformStoreUsage(storeId);
  }
  async getPlatformStoreActivity(storeId: string) {
    return this.platformStoreService.getPlatformStoreActivity(storeId);
  }
  async getPlatformStoreDomains(storeId: string) {
    return this.platformStoreService.getPlatformStoreDomains(storeId);
  }
  async getPlatformStoreSubscription(storeId: string) {
    return this.platformStoreService.getPlatformStoreSubscription(storeId);
  }
  async getPlatformStore360(storeId: string) {
    return this.platformStoreService.getPlatformStore360(storeId);
  }
  async getPlatformStoreBillingProfile(storeId: string) {
    return this.platformStoreService.getPlatformStoreBillingProfile(storeId);
  }
  async updateStoreSuspension(
    storeId: string,
    input: UpdateStoreSuspensionDto,
    context: RequestContextData,
  ): Promise<void> {
    return this.platformStoreService.updateStoreSuspension(storeId, input, context);
  }
  async previewStoreDeletion(
    storeId: string,
    currentUser: PlatformAdminUser,
    context: RequestContextData,
  ) {
    return this.platformStoreService.previewStoreDeletion(storeId, currentUser, context);
  }
  async confirmStoreDeletion(
    storeId: string,
    input: ConfirmStoreDeletionDto,
    currentUser: PlatformAdminUser,
    context: RequestContextData,
  ) {
    return this.platformStoreService.confirmStoreDeletion(storeId, input, currentUser, context);
  }
  async getStoreDeletionStatus(storeId: string) {
    return this.platformStoreService.getStoreDeletionStatus(storeId);
  }
  async retryStorePurge(
    storeId: string,
    input: RetryStorePurgeDto,
    currentUser: PlatformAdminUser,
    context: RequestContextData,
  ) {
    return this.platformStoreService.retryStorePurge(storeId, input, currentUser, context);
  }
  async listPlatformStoreNotes(storeId: string) {
    return this.platformStoreService.listPlatformStoreNotes(storeId);
  }
  async createPlatformStoreNote(
    storeId: string,
    input: CreateStoreNoteDto,
    currentUser: PlatformAdminUser,
    context: RequestContextData,
  ) {
    return this.platformStoreService.createPlatformStoreNote(storeId, input, currentUser, context);
  }

  async listPlatformAdmins() {
    return this.platformAdminService.listPlatformAdmins();
  }
  async createPlatformAdmin(
    input: CreatePlatformAdminDto,
    currentUser: PlatformAdminUser,
    context: RequestContextData,
  ) {
    return this.platformAdminService.createPlatformAdmin(input, currentUser, context);
  }
  async updatePlatformAdmin(
    adminId: string,
    input: UpdatePlatformAdminDto,
    currentUser: PlatformAdminUser,
    context: RequestContextData,
  ) {
    return this.platformAdminService.updatePlatformAdmin(adminId, input, currentUser, context);
  }
  async listPlatformRoles() {
    return this.platformAdminService.listPlatformRoles();
  }
  async listPlatformPermissionCatalog() {
    return this.platformAdminService.listPlatformPermissionCatalog();
  }
  async createPlatformRole(
    input: CreatePlatformRoleDto,
    currentUser: PlatformAdminUser,
    context: RequestContextData,
  ) {
    return this.platformAdminService.createPlatformRole(input, currentUser, context);
  }
  async updatePlatformRole(
    roleId: string,
    input: UpdatePlatformRoleDto,
    currentUser: PlatformAdminUser,
    context: RequestContextData,
  ) {
    return this.platformAdminService.updatePlatformRole(roleId, input, currentUser, context);
  }
  async getPlatformSettings() {
    return this.platformAdminService.getPlatformSettings();
  }
  async updatePlatformSettings(
    input: UpdatePlatformSettingsDto,
    currentUser: PlatformAdminUser,
    context: RequestContextData,
  ) {
    return this.platformAdminService.updatePlatformSettings(input, currentUser, context);
  }

  async getPlatformDashboardSummary() {
    return this.platformDashboardService.getPlatformDashboardSummary();
  }
  async getPlatformDashboardAlerts() {
    return this.platformDashboardService.getPlatformDashboardAlerts();
  }
  async getPlatformDashboardActivity() {
    return this.platformDashboardService.getPlatformDashboardActivity();
  }
  async getPlatformDashboardGrowth() {
    return this.platformDashboardService.getPlatformDashboardGrowth();
  }
  async getPlatformAnalyticsMrrChurn() {
    return this.platformDashboardService.getPlatformAnalyticsMrrChurn();
  }
  async getPlatformAnalyticsCohorts() {
    return this.platformDashboardService.getPlatformAnalyticsCohorts();
  }
  async getPlatformAnalyticsFunnel() {
    return this.platformDashboardService.getPlatformAnalyticsFunnel();
  }
  async getPlatformAnalyticsOverview() {
    return this.platformDashboardService.getPlatformAnalyticsOverview();
  }
  async listPlatformAuditLogs(input: {
    q?: string;
    action?: string;
    storeId?: string;
    page?: number;
    limit?: number;
  }) {
    return this.platformDashboardService.listPlatformAuditLogs(input);
  }
  async getPlatformHealthSummary() {
    return this.platformDashboardService.getPlatformHealthSummary();
  }
  async getPlatformHealthQueues() {
    return this.platformDashboardService.getPlatformHealthQueues();
  }
  async getPlatformOnboardingPipeline() {
    return this.platformDashboardService.getPlatformOnboardingPipeline();
  }
  async getPlatformOnboardingStuckStores() {
    return this.platformDashboardService.getPlatformOnboardingStuckStores();
  }

  async listPlatformDomains() {
    return this.platformDomainService.listPlatformDomains();
  }
  async listPlatformDomainIssues() {
    return this.platformDomainService.listPlatformDomainIssues();
  }
  async getPlatformDomainById(domainId: string) {
    return this.platformDomainService.getPlatformDomainById(domainId);
  }
  async recheckPlatformDomain(domainId: string, context: RequestContextData) {
    return this.platformDomainService.recheckPlatformDomain(domainId, context);
  }
  async forceSyncPlatformDomain(domainId: string, context: RequestContextData) {
    return this.platformDomainService.forceSyncPlatformDomain(domainId, context);
  }
  async listPlatformSubscriptions(query: ListPlatformSubscriptionsQueryDto) {
    return this.platformDomainService.listPlatformSubscriptions(query);
  }

  async listPlatformIncidents() {
    return this.platformOperationsService.listPlatformIncidents();
  }
  async createPlatformIncident(
    input: CreatePlatformIncidentDto,
    currentUser: PlatformAdminUser,
    context: RequestContextData,
  ) {
    return this.platformOperationsService.createPlatformIncident(input, currentUser, context);
  }
  async updatePlatformIncidentStatus(
    incidentId: string,
    input: UpdatePlatformIncidentStatusDto,
    context: RequestContextData,
  ) {
    return this.platformOperationsService.updatePlatformIncidentStatus(incidentId, input, context);
  }
  async listPlatformAutomationRules() {
    return this.platformOperationsService.listPlatformAutomationRules();
  }
  async createPlatformAutomationRule(
    input: CreatePlatformAutomationRuleDto,
    currentUser: PlatformAdminUser,
    context: RequestContextData,
  ) {
    return this.platformOperationsService.createPlatformAutomationRule(input, currentUser, context);
  }
  async updatePlatformAutomationRuleStatus(
    ruleId: string,
    input: UpdatePlatformAutomationRuleStatusDto,
    currentUser: PlatformAdminUser,
    context: RequestContextData,
  ) {
    return this.platformOperationsService.updatePlatformAutomationRuleStatus(
      ruleId,
      input,
      currentUser,
      context,
    );
  }
  async triggerPlatformAutomationRule(
    ruleId: string,
    input: TriggerPlatformAutomationRuleDto,
    currentUser: PlatformAdminUser,
    context: RequestContextData,
  ) {
    return this.platformOperationsService.triggerPlatformAutomationRule(
      ruleId,
      input,
      currentUser,
      context,
    );
  }
  async listPlatformAutomationRuns(limit = 100) {
    return this.platformOperationsService.listPlatformAutomationRuns(limit);
  }
  async listPlatformSupportCases(limit = 100) {
    return this.platformOperationsService.listPlatformSupportCases(limit);
  }
  async getPlatformSupportCaseById(caseId: string) {
    return this.platformOperationsService.getPlatformSupportCaseById(caseId);
  }
  async createPlatformSupportCase(
    input: CreatePlatformSupportCaseDto,
    currentUser: PlatformAdminUser,
    context: RequestContextData,
  ) {
    return this.platformOperationsService.createPlatformSupportCase(input, currentUser, context);
  }
  async updatePlatformSupportCase(
    caseId: string,
    input: UpdatePlatformSupportCaseDto,
    currentUser: PlatformAdminUser,
    context: RequestContextData,
  ) {
    return this.platformOperationsService.updatePlatformSupportCase(
      caseId,
      input,
      currentUser,
      context,
    );
  }
  async addPlatformSupportCaseComment(
    caseId: string,
    input: PlatformInternalCommentDto,
    currentUser: PlatformAdminUser,
    context: RequestContextData,
  ) {
    return this.platformOperationsService.addPlatformSupportCaseComment(
      caseId,
      input,
      currentUser,
      context,
    );
  }
  async listPlatformRiskViolations(limit = 100) {
    return this.platformOperationsService.listPlatformRiskViolations(limit);
  }
  async getPlatformRiskViolationById(violationId: string) {
    return this.platformOperationsService.getPlatformRiskViolationById(violationId);
  }
  async createPlatformRiskViolation(
    input: CreatePlatformRiskViolationDto,
    currentUser: PlatformAdminUser,
    context: RequestContextData,
  ) {
    return this.platformOperationsService.createPlatformRiskViolation(input, currentUser, context);
  }
  async updatePlatformRiskViolationStatus(
    violationId: string,
    input: UpdatePlatformRiskViolationStatusDto,
    context: RequestContextData,
  ) {
    return this.platformOperationsService.updatePlatformRiskViolationStatus(
      violationId,
      input,
      context,
    );
  }
  async addPlatformRiskViolationNote(
    violationId: string,
    input: PlatformInternalCommentDto,
    currentUser: PlatformAdminUser,
    context: RequestContextData,
  ) {
    return this.platformOperationsService.addPlatformRiskViolationNote(
      violationId,
      input,
      currentUser,
      context,
    );
  }
  async listPlatformComplianceTasks(limit = 100) {
    return this.platformOperationsService.listPlatformComplianceTasks(limit);
  }
  async getPlatformComplianceTaskById(taskId: string) {
    return this.platformOperationsService.getPlatformComplianceTaskById(taskId);
  }
  async createPlatformComplianceTask(
    input: CreatePlatformComplianceTaskDto,
    currentUser: PlatformAdminUser,
    context: RequestContextData,
  ) {
    return this.platformOperationsService.createPlatformComplianceTask(input, currentUser, context);
  }
  async updatePlatformComplianceTaskStatus(
    taskId: string,
    input: UpdatePlatformComplianceTaskStatusDto,
    context: RequestContextData,
  ) {
    return this.platformOperationsService.updatePlatformComplianceTaskStatus(
      taskId,
      input,
      context,
    );
  }
  async addPlatformComplianceTaskComment(
    taskId: string,
    input: PlatformInternalCommentDto,
    currentUser: PlatformAdminUser,
    context: RequestContextData,
  ) {
    return this.platformOperationsService.addPlatformComplianceTaskComment(
      taskId,
      input,
      currentUser,
      context,
    );
  }
  async addPlatformComplianceTaskEvidence(
    taskId: string,
    input: PlatformInternalCommentDto,
    currentUser: PlatformAdminUser,
    context: RequestContextData,
  ) {
    return this.platformOperationsService.addPlatformComplianceTaskEvidence(
      taskId,
      input,
      currentUser,
      context,
    );
  }
  async getPlatformFinanceOverview() {
    return this.platformOperationsService.getPlatformFinanceOverview();
  }
  async getBillingSubscriptionsOverview() {
    return this.platformOperationsService.getBillingSubscriptionsOverview();
  }
  async getBillingReportSummary(query: {
    from?: string;
    to?: string;
    groupBy?: 'day' | 'week' | 'month';
    currency?: string;
  }) {
    return this.platformOperationsService.getBillingReportSummary(query);
  }
  async listPlatformFinanceAging() {
    return this.platformOperationsService.listPlatformFinanceAging();
  }
  async listPlatformFinanceCollections(limit = 100) {
    return this.platformOperationsService.listPlatformFinanceCollections(limit);
  }

  async exportPlatformStoresCsv(query: ListPlatformStoresQueryDto) {
    return this.exportService.exportPlatformStoresCsv(query);
  }
  async exportPlatformSubscriptionsCsv(query: ListPlatformSubscriptionsQueryDto) {
    return this.exportService.exportPlatformSubscriptionsCsv(query);
  }
  async exportPlatformInvoicesCsv() {
    return this.exportService.exportPlatformInvoicesCsv();
  }
  async exportPlatformDomainsCsv() {
    return this.exportService.exportPlatformDomainsCsv();
  }
  async exportPlatformSupportCasesCsv() {
    return this.exportService.exportPlatformSupportCasesCsv();
  }
  async exportPlatformRiskViolationsCsv() {
    return this.exportService.exportPlatformRiskViolationsCsv();
  }
  async exportPlatformComplianceTasksCsv() {
    return this.exportService.exportPlatformComplianceTasksCsv();
  }
}

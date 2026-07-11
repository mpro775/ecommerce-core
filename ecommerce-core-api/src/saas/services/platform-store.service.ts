import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AuditService } from '../../audit/audit.service';
import type { RequestContextData } from '../../common/utils/request-context.util';
import type { PlatformAdminUser } from '../../platform/interfaces/platform-admin-user.interface';
import type { ConfirmStoreDeletionDto } from '../dto/confirm-store-deletion.dto';
import type { CreateStoreNoteDto } from '../dto/create-store-note.dto';
import type { ListPlatformStoresQueryDto } from '../dto/list-platform-stores-query.dto';
import type { RetryStorePurgeDto } from '../dto/retry-store-purge.dto';
import type { UpdateStoreSuspensionDto } from '../dto/update-store-suspension.dto';
import { SaasRepository } from '../saas.repository';
import { SaasHelpers } from './helpers';
import { PlatformOperationsService } from './platform-operations.service';
import { SubscriptionService } from './subscription.service';
import type { StoreSubscriptionResponse } from './types';

@Injectable()
export class PlatformStoreService {
  constructor(
    private readonly saasRepository: SaasRepository,
    private readonly auditService: AuditService,
    private readonly subscriptionService: SubscriptionService,
    private readonly platformOperationsService: PlatformOperationsService,
  ) {}

  async listPlatformStores(query: ListPlatformStoresQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const result = await this.saasRepository.listPlatformStores({
      q: query.q?.trim() ?? null,
      planCode: query.planCode?.trim().toLowerCase() || null,
      subscriptionStatus: query.subscriptionStatus ?? null,
      isSuspended: query.isSuspended ?? null,
      limit,
      offset: (page - 1) * limit,
    });

    return {
      items: result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        createdAt: row.created_at,
        status: row.status,
        isSuspended: row.is_suspended,
        suspensionReason: row.suspension_reason,
        deletedAt: row.deleted_at,
        deletionReason: row.deletion_reason,
        purgeStatus: row.purge_status,
        planCode: row.plan_code,
        subscriptionStatus: row.subscription_status,
        totalDomains: row.total_domains,
        activeDomains: row.active_domains,
      })),
      total: result.total,
      page,
      limit,
    };
  }

  async getPlatformStoreById(storeId: string) {
    const row = await this.saasRepository.findPlatformStoreById(storeId);
    if (!row) {
      throw new NotFoundException('Store not found');
    }

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      createdAt: row.created_at,
      status: row.status,
      isSuspended: row.is_suspended,
      suspensionReason: row.suspension_reason,
      deletedAt: row.deleted_at,
      deletedByPlatformAdminId: row.deleted_by_platform_admin_id,
      deletionReason: row.deletion_reason,
      purgeStatus: row.purge_status,
      purgeStartedAt: row.purge_started_at,
      purgeCompletedAt: row.purge_completed_at,
      purgeError: row.purge_error,
      planCode: row.plan_code,
      subscriptionStatus: row.subscription_status,
      totalDomains: row.total_domains,
      activeDomains: row.active_domains,
    };
  }

  async getPlatformStoreUsage(storeId: string) {
    const subscription =
      await this.subscriptionService.requireCurrentSubscriptionWithDefaults(storeId);
    const limits = await this.saasRepository.listPlanLimits(subscription.plan_id);
    const usage = await this.subscriptionService.resolveUsageSnapshot(storeId, limits, new Date());
    return {
      storeId,
      subscriptionStatus: subscription.status,
      usage,
    };
  }

  async getPlatformStoreActivity(storeId: string) {
    const rows = await this.saasRepository.listStoreAuditActivity(storeId, 50);
    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      targetType: row.target_type,
      targetId: row.target_id,
      metadata: row.metadata,
      createdAt: row.created_at,
      storeId: row.store_id,
    }));
  }

  async getPlatformStoreDomains(storeId: string) {
    const rows = await this.saasRepository.listPlatformDomainsByStore(storeId);
    return rows.map((row) => SaasHelpers.toPlatformDomainResponse(row));
  }

  async getPlatformStoreSubscription(storeId: string): Promise<StoreSubscriptionResponse> {
    const subscription =
      await this.subscriptionService.requireCurrentSubscriptionWithDefaults(storeId);
    const limits = await this.saasRepository.listPlanLimits(subscription.plan_id);
    const entitlements = await this.saasRepository.listPlanEntitlements(subscription.plan_id);
    const usage = await this.subscriptionService.resolveUsageSnapshot(storeId, limits, new Date());
    return SaasHelpers.toSubscriptionResponse(subscription, limits, entitlements, usage);
  }

  async getPlatformStore360(storeId: string) {
    const store = await this.getPlatformStoreById(storeId);
    const [
      usage,
      activity,
      domains,
      subscription,
      notes,
      supportCases,
      riskViolations,
      financeCollections,
    ] = await Promise.all([
      this.getPlatformStoreUsage(storeId),
      this.getPlatformStoreActivity(storeId),
      this.getPlatformStoreDomains(storeId),
      this.getPlatformStoreSubscription(storeId),
      this.listPlatformStoreNotes(storeId),
      this.platformOperationsService.listPlatformSupportCases(200),
      this.platformOperationsService.listPlatformRiskViolations(200),
      this.platformOperationsService.listPlatformFinanceCollections(200),
    ]);
    const scopedSupportCases = supportCases.filter((item) => item.storeId === storeId);
    const scopedRiskViolations = riskViolations.filter((item) => item.storeId === storeId);
    const scopedInvoices = financeCollections.filter((item) => item.storeId === storeId);

    return {
      store,
      owner: null,
      subscription,
      plan: subscription.plan,
      domains,
      usage,
      activity,
      notes,
      invoicesSummary: {
        openCount: scopedInvoices.length,
        openAmount: scopedInvoices.reduce((sum, item) => sum + item.totalAmount, 0),
        latest: scopedInvoices.slice(0, 5),
      },
      supportSummary: {
        openCount: scopedSupportCases.filter(
          (item) => !['resolved', 'closed'].includes(item.status),
        ).length,
        latest: scopedSupportCases.slice(0, 5),
      },
      riskSummary: {
        openCount: scopedRiskViolations.filter((item) => item.status !== 'resolved').length,
        latest: scopedRiskViolations.slice(0, 5),
      },
      tabs: {
        overview: store,
        usage,
        activity,
        domains,
        subscription,
        notes,
        supportCases: scopedSupportCases,
        riskViolations: scopedRiskViolations,
      },
    };
  }

  async getPlatformStoreBillingProfile(storeId: string) {
    const store = await this.getPlatformStoreById(storeId);
    const subscription =
      await this.subscriptionService.requireCurrentSubscriptionWithDefaults(storeId);
    const [
      limits,
      usage,
      invoices,
      payments,
      receipts,
      adjustments,
      couponRedemptions,
      billingEvents,
    ] = await Promise.all([
      this.saasRepository.listPlanLimits(subscription.plan_id),
      this.getPlatformStoreUsage(storeId),
      this.saasRepository.listInvoicesByStore({ storeId, status: null, limit: 10, offset: 0 }),
      this.saasRepository.listPaymentsByStore(storeId, 25),
      this.saasRepository.listSubscriptionReceipts({ storeId, page: 1, limit: 25 }),
      this.saasRepository.listSubscriptionAdjustmentsByStore(storeId, { page: 1, limit: 25 }),
      this.saasRepository.listSubscriptionCouponRedemptionsByStore(storeId, 25),
      this.saasRepository.listRecentBillingEvents(100),
    ]);

    const now = new Date();
    const currentPeriodEnd = subscription.current_period_end;
    const daysRemaining = currentPeriodEnd
      ? Math.max(0, Math.ceil((currentPeriodEnd.getTime() - now.getTime()) / 86_400_000))
      : 0;
    const usageByKey = new Map(usage.usage.map((item) => [item.metricKey, item.used]));

    return {
      store: {
        id: store.id,
        name: store.name,
        ownerEmail: null,
      },
      subscription: {
        id: subscription.id,
        planCode: subscription.plan_code,
        planName: subscription.plan_name,
        status: subscription.status,
        billingCycle: subscription.billing_cycle,
        startedAt: subscription.starts_at,
        currentPeriodStart: subscription.starts_at,
        currentPeriodEnd: subscription.current_period_end,
        nextBillingAt: subscription.next_billing_at,
        daysRemaining,
        isExpired:
          subscription.status === 'expired' || (currentPeriodEnd ? currentPeriodEnd < now : false),
        isInTrial: subscription.status === 'trialing',
      },
      planLimits: limits.map((limit) => {
        const used = usageByKey.get(limit.metric_key) ?? 0;
        return {
          key: limit.metric_key,
          limit: limit.metric_limit,
          used,
          remaining: limit.metric_limit === null ? null : Math.max(0, limit.metric_limit - used),
        };
      }),
      invoices: invoices.rows.map((invoice) => SaasHelpers.toInvoiceResponse(invoice)),
      payments: payments.map((payment) => ({
        id: payment.id,
        invoiceId: payment.invoice_id,
        provider: payment.provider,
        paymentMethod: payment.payment_method,
        status: payment.status,
        amount: Number(payment.amount),
        currencyCode: payment.currency_code,
        externalTransactionId: payment.external_transaction_id,
        failureReason: payment.failure_reason,
        processedAt: payment.processed_at,
        createdAt: payment.created_at,
      })),
      receipts: receipts.items.map((receipt) => ({
        id: receipt.id,
        invoiceId: receipt.invoice_id,
        invoiceNumber: receipt.invoice_number ?? null,
        status: receipt.status,
        amount: Number(receipt.amount),
        currencyCode: receipt.currency_code,
        transactionReference: receipt.transaction_reference,
        receiptUrl: receipt.receipt_url,
        rejectionReason: receipt.rejection_reason,
        createdAt: receipt.created_at,
        reviewedAt: receipt.reviewed_at,
      })),
      adjustments: adjustments.items.map((adjustment) => ({
        id: adjustment.id,
        operation: adjustment.operation,
        accountingCategory: adjustment.accounting_category,
        affectsRevenue: adjustment.affects_revenue,
        amount: adjustment.amount === null ? null : Number(adjustment.amount),
        currencyCode: adjustment.currency_code,
        daysDelta: adjustment.days_delta,
        reason: adjustment.reason,
        createdAt: adjustment.created_at,
      })),
      couponRedemptions: couponRedemptions.map((redemption) => ({
        id: redemption.id,
        couponId: redemption.coupon_id,
        couponCode: redemption.coupon_code,
        discountAmount: Number(redemption.discount_amount),
        finalAmount: Number(redemption.final_amount),
        billingCycle: redemption.billing_cycle,
        redeemedAt: redemption.redeemed_at,
      })),
      billingEvents: billingEvents
        .filter((event) => event.store_id === storeId)
        .map((event) => ({
          id: event.id,
          source: event.source,
          eventType: event.event_type,
          status: event.status,
          processingError: event.processing_error,
          createdAt: event.created_at,
        })),
    };
  }

  async updateStoreSuspension(
    storeId: string,
    input: UpdateStoreSuspensionDto,
    context: RequestContextData,
  ): Promise<void> {
    const success = await this.saasRepository.setStoreSuspension({
      storeId,
      isSuspended: input.isSuspended,
      reason: input.reason?.trim() ?? null,
    });
    if (!success) {
      throw new NotFoundException('Store not found');
    }

    await this.auditService.log({
      action: 'platform.store_suspension_updated',
      storeId,
      storeUserId: null,
      targetType: 'store',
      targetId: storeId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        requestId: context.requestId,
        isSuspended: input.isSuspended,
        reason: input.reason ?? null,
      },
    });
  }

  async previewStoreDeletion(
    storeId: string,
    currentUser: PlatformAdminUser,
    context: RequestContextData,
  ) {
    const row = await this.saasRepository.getStoreDeletionPreview(storeId);
    if (!row) {
      throw new NotFoundException('Store not found');
    }

    const blockingReasons: string[] = [];
    if (row.status === 'deleted') {
      blockingReasons.push('Store is already deleted');
    }
    if (row.has_open_disputes) {
      blockingReasons.push('Store has open risk/dispute records');
    }
    if (row.has_pending_payments) {
      blockingReasons.push('Store has pending payments under review');
    }

    const response = {
      storeId: row.id,
      storeName: row.name,
      ownerEmail: row.status === 'deleted' ? null : row.owner_email,
      status: row.status,
      isSuspended: row.is_suspended,
      deletedAt: row.deleted_at,
      deletionReason: row.deletion_reason,
      purgeStatus: row.purge_status,
      ordersCount: row.orders_count,
      productsCount: row.products_count,
      domainsCount: row.domains_count,
      hasActiveSubscription: row.has_active_subscription,
      hasOpenDisputes: row.has_open_disputes,
      hasPendingPayments: row.has_pending_payments,
      canDelete: blockingReasons.length === 0,
      blockingReasons,
      warnings: [
        'سيتم إيقاف المتجر فورًا',
        'سيتم تحرير الإيميل ليتمكن التاجر من التسجيل من جديد',
        'لن يتم حذف الفواتير أو المدفوعات أو سجلات التدقيق أو الطلبات السابقة',
      ],
      requiredConfirmationText: row.name,
    };

    await this.auditService.log({
      action: 'platform.store_deletion_previewed',
      storeId,
      storeUserId: null,
      platformAdminId: currentUser.id,
      targetType: 'store',
      targetId: storeId,
      category: 'platform_store_deletion',
      severity: 'warning',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        requestId: context.requestId,
        ordersCount: row.orders_count,
        productsCount: row.products_count,
        domainsCount: row.domains_count,
        canDelete: response.canDelete,
        blockingReasons,
      },
    });

    return response;
  }

  async confirmStoreDeletion(
    storeId: string,
    input: ConfirmStoreDeletionDto,
    currentUser: PlatformAdminUser,
    context: RequestContextData,
  ) {
    const reason = input.reason.trim();
    const releaseEmail = input.releaseEmail ?? true;
    const purgeOperationalData = input.purgeOperationalData ?? true;

    if (!releaseEmail) {
      throw new BadRequestException('releaseEmail must be true for permanent store deletion');
    }

    const preview = await this.saasRepository.getStoreDeletionPreview(storeId);
    if (!preview) {
      throw new NotFoundException('Store not found');
    }
    if (preview.status === 'deleted') {
      throw new ConflictException('Store is already deleted');
    }
    if (input.confirmationText.trim() !== preview.name) {
      throw new BadRequestException('Confirmation text does not match store name');
    }
    if (preview.has_open_disputes || preview.has_pending_payments) {
      throw new ConflictException({
        message: 'Store deletion is blocked',
        blockingReasons: [
          ...(preview.has_open_disputes ? ['Store has open risk/dispute records'] : []),
          ...(preview.has_pending_payments ? ['Store has pending payments under review'] : []),
        ],
      });
    }

    const result = await this.saasRepository.withTransaction(async (db) => {
      const locked = await this.saasRepository.findPlatformStoreByIdForUpdate(storeId, db);
      if (!locked) {
        throw new NotFoundException('Store not found');
      }
      if (locked.status === 'deleted') {
        throw new ConflictException('Store is already deleted');
      }

      await this.saasRepository.markStoreDeleted(
        {
          storeId,
          platformAdminId: currentUser.id,
          reason,
          purgeStatus: purgeOperationalData ? 'pending' : 'not_started',
        },
        db,
      );

      const anonymizedUsers = await this.saasRepository.anonymizeStoreUsers(storeId, db);
      const revokedSessions = await this.saasRepository.revokeStoreSessions(storeId, db);
      await this.saasRepository.updateSubscriptionStatus(storeId, 'canceled', db);
      const disabledDomains = await this.saasRepository.disableStoreDomains(storeId, db);
      const purgeJobId = purgeOperationalData
        ? await this.saasRepository.createStoreDeletionPurgeJob(
            {
              storeId,
              platformAdminId: currentUser.id,
              metadata: {
                reason,
                ordersCount: preview.orders_count,
                productsCount: preview.products_count,
                domainsCount: preview.domains_count,
              },
            },
            db,
          )
        : null;

      const emailHashes = anonymizedUsers.map((user) => ({
        userId: user.id,
        originalEmailHash: this.hashEmail(user.original_email),
        anonymizedEmail: user.anonymized_email,
      }));

      await this.auditService.log(
        {
          action: 'platform.store_deletion_confirmed',
          storeId,
          storeUserId: null,
          platformAdminId: currentUser.id,
          targetType: 'store',
          targetId: storeId,
          category: 'platform_store_deletion',
          severity: 'critical',
          beforeSnapshot: {
            status: locked.status,
            isSuspended: locked.is_suspended,
            subscriptionStatus: locked.subscription_status,
          },
          afterSnapshot: {
            status: 'deleted',
            isSuspended: true,
            purgeStatus: purgeOperationalData ? 'pending' : 'not_started',
          },
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          metadata: {
            requestId: context.requestId,
            reason,
            releaseEmail,
            purgeOperationalData,
            ordersCount: preview.orders_count,
            productsCount: preview.products_count,
            domainsCount: preview.domains_count,
            anonymizedUsers: emailHashes,
            revokedSessions,
            disabledDomains,
            purgeJobId,
          },
        },
        db,
      );

      await this.auditService.log(
        {
          action: 'platform.store_deleted',
          storeId,
          storeUserId: null,
          platformAdminId: currentUser.id,
          targetType: 'store',
          targetId: storeId,
          category: 'platform_store_deletion',
          severity: 'critical',
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          metadata: { requestId: context.requestId, reason },
        },
        db,
      );

      await this.auditService.log(
        {
          action: 'platform.store_email_anonymized',
          storeId,
          storeUserId: null,
          platformAdminId: currentUser.id,
          targetType: 'store_user',
          targetId: storeId,
          category: 'platform_store_deletion',
          severity: 'warning',
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          metadata: { requestId: context.requestId, anonymizedUsers: emailHashes },
        },
        db,
      );

      await this.auditService.log(
        {
          action: 'platform.store_sessions_revoked',
          storeId,
          storeUserId: null,
          platformAdminId: currentUser.id,
          targetType: 'store',
          targetId: storeId,
          category: 'platform_store_deletion',
          severity: 'warning',
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          metadata: { requestId: context.requestId, revokedSessions },
        },
        db,
      );

      await this.auditService.log(
        {
          action: 'platform.store_subscription_cancelled',
          storeId,
          storeUserId: null,
          platformAdminId: currentUser.id,
          targetType: 'store_subscription',
          targetId: storeId,
          category: 'platform_store_deletion',
          severity: 'warning',
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          metadata: { requestId: context.requestId },
        },
        db,
      );

      await this.auditService.log(
        {
          action: 'platform.store_domains_detached',
          storeId,
          storeUserId: null,
          platformAdminId: currentUser.id,
          targetType: 'store_domain',
          targetId: storeId,
          category: 'platform_store_deletion',
          severity: 'warning',
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          metadata: { requestId: context.requestId, disabledDomains },
        },
        db,
      );

      return {
        storeId,
        status: 'deleted',
        purgeStatus: purgeOperationalData ? 'pending' : 'not_started',
        purgeJobId,
        anonymizedUsers: anonymizedUsers.length,
        revokedSessions,
        disabledDomains,
      };
    });

    return result;
  }

  async getStoreDeletionStatus(storeId: string) {
    const status = await this.saasRepository.getStoreDeletionStatus(storeId);
    if (!status) {
      throw new NotFoundException('Store not found');
    }

    return {
      storeId: status.store_id,
      status: status.status,
      deletedAt: status.deleted_at,
      deletedByPlatformAdminId: status.deleted_by_platform_admin_id,
      deletionReason: status.deletion_reason,
      purgeStatus: status.purge_status,
      purgeStartedAt: status.purge_started_at,
      purgeCompletedAt: status.purge_completed_at,
      purgeError: status.purge_error,
      latestPurgeJob: status.latest_purge_job_id
        ? {
            id: status.latest_purge_job_id,
            status: status.latest_purge_job_status,
            attempts: status.latest_purge_job_attempts,
            error: status.latest_purge_job_error,
          }
        : null,
    };
  }

  async retryStorePurge(
    storeId: string,
    input: RetryStorePurgeDto,
    currentUser: PlatformAdminUser,
    context: RequestContextData,
  ) {
    const status = await this.saasRepository.getStoreDeletionStatus(storeId);
    if (!status) {
      throw new NotFoundException('Store not found');
    }
    if (status.status !== 'deleted') {
      throw new BadRequestException('Only deleted stores can retry purge');
    }
    if (status.purge_status !== 'failed') {
      throw new BadRequestException('Purge retry is only allowed after a failed purge');
    }

    const purgeJobId = await this.saasRepository.retryStoreDeletionPurge({
      storeId,
      platformAdminId: currentUser.id,
      reason: input.reason?.trim() || null,
    });

    await this.auditService.log({
      action: 'platform.store_purge_retried',
      storeId,
      storeUserId: null,
      platformAdminId: currentUser.id,
      targetType: 'store_deletion_purge_job',
      targetId: purgeJobId,
      category: 'platform_store_deletion',
      severity: 'warning',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        requestId: context.requestId,
        reason: input.reason?.trim() || null,
        previousError: status.purge_error,
      },
    });

    return {
      storeId,
      purgeStatus: 'pending',
      purgeJobId,
    };
  }

  async listPlatformStoreNotes(storeId: string) {
    const store = await this.saasRepository.findPlatformStoreById(storeId);
    if (!store) {
      throw new NotFoundException('Store not found');
    }

    const rows = await this.saasRepository.listStoreNotes(storeId, 100);
    return rows.map((row) => ({
      id: row.id,
      storeId: row.store_id,
      authorAdminId: row.author_admin_id,
      authorName: row.author_name,
      type: row.type,
      body: row.body,
      pinned: row.pinned,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  private hashEmail(email: string): string {
    return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
  }

  async createPlatformStoreNote(
    storeId: string,
    input: CreateStoreNoteDto,
    currentUser: PlatformAdminUser,
    context: RequestContextData,
  ) {
    const store = await this.saasRepository.findPlatformStoreById(storeId);
    if (!store) {
      throw new NotFoundException('Store not found');
    }

    const created = await this.saasRepository.createStoreNote({
      storeId,
      authorAdminId: currentUser.id,
      type: input.type?.trim().toLowerCase() || 'general',
      body: input.body.trim(),
      pinned: input.pinned ?? false,
    });

    await this.auditService.log({
      action: 'platform.store_note_created',
      storeId,
      storeUserId: null,
      targetType: 'platform_store_note',
      targetId: created.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        requestId: context.requestId,
        type: created.type,
        pinned: created.pinned,
      },
    });

    return {
      id: created.id,
      storeId: created.store_id,
      authorAdminId: created.author_admin_id,
      authorName: currentUser.fullName,
      type: created.type,
      body: created.body,
      pinned: created.pinned,
      createdAt: created.created_at,
      updatedAt: created.updated_at,
    };
  }
}

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import type { RequestContextData } from '../../common/utils/request-context.util';
import type { PlatformAdminUser } from '../../platform/interfaces/platform-admin-user.interface';
import type { AdjustSubscriptionDto } from '../dto/adjust-subscription.dto';
import type { ListSubscriptionAdjustmentsQueryDto } from '../dto/list-subscription-adjustments-query.dto';
import type { CurrentSubscriptionRecord, SubscriptionAdjustmentRecord } from '../repository/types';
import { SaasRepository } from '../saas.repository';
import type { StoreSubscriptionResponse, SubscriptionAdjustmentResponse } from './types';
import { SaasHelpers } from './helpers';

@Injectable()
export class SubscriptionAdjustmentService {
  constructor(
    private readonly saasRepository: SaasRepository,
    private readonly auditService: AuditService,
  ) {}

  async adjustStoreSubscription(
    storeId: string,
    input: AdjustSubscriptionDto,
    currentUser: PlatformAdminUser,
    context: RequestContextData,
  ): Promise<{
    subscription: StoreSubscriptionResponse;
    adjustment: SubscriptionAdjustmentResponse;
  }> {
    this.validateFinancialRules(input);

    const result = await this.saasRepository.withTransaction(async (db) => {
      const before = await this.saasRepository.getCurrentSubscriptionForUpdate(storeId, db);
      if (!before) {
        throw new NotFoundException('Subscription not found');
      }

      const patch = this.buildPatch(before, input);

      if (patch.status !== undefined) {
        await this.saasRepository.updateSubscriptionStatus(storeId, patch.status, db);
      }

      await this.saasRepository.updateCurrentSubscriptionBilling(
        {
          storeId,
          billingCycle: patch.billingCycle,
          currentPeriodEnd: patch.currentPeriodEnd,
          trialEndsAt: patch.trialEndsAt,
          nextBillingAt: patch.nextBillingAt,
          cancelAtPeriodEnd: patch.cancelAtPeriodEnd,
          canceledAt: patch.canceledAt,
        },
        db,
      );

      if (input.operation === 'suspend') {
        await this.saasRepository.setStoreSuspension(
          { storeId, isSuspended: true, reason: input.reason },
          db,
        );
      }

      if (input.operation === 'resume') {
        await this.saasRepository.setStoreSuspension(
          { storeId, isSuspended: false, reason: null },
          db,
        );
      }

      const after = await this.saasRepository.getCurrentSubscriptionForUpdate(storeId, db);
      if (!after) {
        throw new NotFoundException('Subscription not found');
      }

      const adjustment = await this.saasRepository.createSubscriptionAdjustment(
        {
          storeId,
          subscriptionId: before.id,
          operation: input.operation,
          accountingCategory: input.accountingCategory,
          affectsRevenue: input.affectsRevenue ?? input.accountingCategory === 'revenue',
          amount: input.amount ?? null,
          currencyCode:
            input.currencyCode?.trim().toUpperCase() ?? (input.amount != null ? 'YER' : null),
          daysDelta: patch.daysDelta,
          oldStatus: before.status,
          newStatus: after.status,
          oldBillingCycle: before.billing_cycle,
          newBillingCycle: after.billing_cycle,
          oldCurrentPeriodEnd: before.current_period_end,
          newCurrentPeriodEnd: after.current_period_end,
          oldNextBillingAt: before.next_billing_at,
          newNextBillingAt: after.next_billing_at,
          oldTrialEndsAt: before.trial_ends_at,
          newTrialEndsAt: after.trial_ends_at,
          reason: input.reason.trim(),
          note: input.note?.trim() || null,
          createdByAdminId: currentUser.id,
          metadata: {
            ...(input.metadata ?? {}),
            requestId: context.requestId,
          },
        },
        db,
      );

      await this.saasRepository.createBillingEvent(
        {
          storeId,
          source: 'internal_admin',
          eventType: 'subscription_adjustment.' + input.operation,
          idempotencyKey: `subscription-adjustment:${adjustment.id}`,
          payload: {
            adjustmentId: adjustment.id,
            subscriptionId: before.id,
            operation: input.operation,
            accountingCategory: input.accountingCategory,
            affectsRevenue: input.affectsRevenue ?? false,
            amount: input.amount ?? null,
            currencyCode:
              input.currencyCode?.trim().toUpperCase() ?? (input.amount != null ? 'YER' : null),
            requestId: context.requestId,
          },
          status: 'processed',
          processedAt: new Date(),
        },
        db,
      );

      await this.auditService.log(
        {
          action: 'platform.subscription_adjusted',
          storeId,
          storeUserId: null,
          targetType: 'store_subscription',
          targetId: before.id,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          metadata: {
            requestId: context.requestId,
            adjustmentId: adjustment.id,
            operation: input.operation,
            reason: input.reason,
            adminId: currentUser.id,
          },
        },
        db,
      );

      return { adjustment };
    });

    const subscription = await this.buildSubscriptionResponse(storeId);
    return {
      subscription,
      adjustment: this.toAdjustmentResponse(result.adjustment),
    };
  }

  async listStoreAdjustments(storeId: string, query: ListSubscriptionAdjustmentsQueryDto) {
    const result = await this.saasRepository.listSubscriptionAdjustmentsByStore(
      storeId,
      this.normalizeQuery(query),
    );
    return {
      ...result,
      items: result.items.map((item) => this.toAdjustmentResponse(item)),
    };
  }

  async listSubscriptionAdjustments(
    subscriptionId: string,
    query: ListSubscriptionAdjustmentsQueryDto,
  ) {
    const result = await this.saasRepository.listSubscriptionAdjustmentsBySubscription(
      subscriptionId,
      this.normalizeQuery(query),
    );
    return {
      ...result,
      items: result.items.map((item) => this.toAdjustmentResponse(item)),
    };
  }

  private buildPatch(
    subscription: CurrentSubscriptionRecord,
    input: AdjustSubscriptionDto,
  ): {
    status?: CurrentSubscriptionRecord['status'];
    billingCycle?: CurrentSubscriptionRecord['billing_cycle'];
    currentPeriodEnd?: Date | null;
    trialEndsAt?: Date | null;
    nextBillingAt?: Date | null;
    cancelAtPeriodEnd?: boolean;
    canceledAt?: Date | null;
    daysDelta: number | null;
  } {
    const days = input.days ?? 0;
    const addDays = (base: Date | null, delta: number) => {
      if (!base) {
        throw new BadRequestException(
          'Cannot reduce subscription period without an active period end',
        );
      }
      return new Date(base.getTime() + delta * 86_400_000);
    };

    if (input.operation === 'extend_period') {
      return {
        currentPeriodEnd: addDays(subscription.current_period_end, days),
        nextBillingAt: subscription.next_billing_at
          ? addDays(subscription.next_billing_at, days)
          : undefined,
        daysDelta: days,
      };
    }

    if (input.operation === 'reduce_period') {
      const periodEnd = addDays(subscription.current_period_end, -days);
      return {
        currentPeriodEnd: periodEnd,
        nextBillingAt: subscription.next_billing_at
          ? addDays(subscription.next_billing_at, -days)
          : undefined,
        status: periodEnd.getTime() <= Date.now() ? 'expired' : undefined,
        daysDelta: -days,
      };
    }

    if (input.operation === 'set_period_end' || input.operation === 'mark_paid_until') {
      const periodEnd = new Date(input.periodEnd as string);
      return {
        currentPeriodEnd: periodEnd,
        nextBillingAt: input.operation === 'mark_paid_until' ? periodEnd : undefined,
        status: input.operation === 'mark_paid_until' ? 'active' : undefined,
        cancelAtPeriodEnd: false,
        canceledAt: null,
        daysDelta: this.daysBetween(subscription.current_period_end, periodEnd),
      };
    }

    if (input.operation === 'set_next_billing_at') {
      return { nextBillingAt: new Date(input.nextBillingAt as string), daysDelta: null };
    }

    if (input.operation === 'grant_trial_days') {
      const base = subscription.trial_ends_at ?? subscription.current_period_end ?? new Date();
      const trialEndsAt = addDays(base, days);
      return {
        status: 'trialing',
        currentPeriodEnd: trialEndsAt,
        trialEndsAt,
        nextBillingAt: trialEndsAt,
        daysDelta: days,
      };
    }

    if (input.operation === 'clear_trial') {
      return {
        status: subscription.status === 'trialing' ? 'active' : undefined,
        trialEndsAt: null,
        currentPeriodEnd: subscription.current_period_end,
        nextBillingAt: subscription.next_billing_at,
        daysDelta: null,
      };
    }

    if (input.operation === 'set_status') {
      return {
        status: input.status,
        canceledAt: input.status === 'canceled' ? new Date() : null,
        nextBillingAt: input.status === 'canceled' ? null : undefined,
        cancelAtPeriodEnd: input.status === 'canceled' ? false : undefined,
        daysDelta: null,
      };
    }

    if (input.operation === 'suspend') {
      return { status: 'suspended', daysDelta: null };
    }

    if (input.operation === 'resume') {
      return {
        status: 'active',
        canceledAt: null,
        cancelAtPeriodEnd: false,
        daysDelta: null,
      };
    }

    if (input.operation === 'cancel') {
      return {
        status: 'canceled',
        nextBillingAt: null,
        cancelAtPeriodEnd: false,
        canceledAt: new Date(),
        daysDelta: null,
      };
    }

    if (input.operation === 'reset_billing_cycle') {
      return { billingCycle: input.billingCycle, daysDelta: null };
    }

    if (
      input.operation === 'manual_correction' ||
      input.operation === 'compensation' ||
      input.operation === 'marketing_gift'
    ) {
      const delta = input.days ?? 0;
      return {
        currentPeriodEnd: delta > 0 ? addDays(subscription.current_period_end, delta) : undefined,
        nextBillingAt:
          delta > 0 && subscription.next_billing_at
            ? addDays(subscription.next_billing_at, delta)
            : undefined,
        daysDelta: delta > 0 ? delta : null,
      };
    }

    throw new BadRequestException('Invalid adjustment operation');
  }

  private validateFinancialRules(input: AdjustSubscriptionDto): void {
    if (!input.reason?.trim()) {
      throw new BadRequestException('Reason is required');
    }
    if (input.currencyCode && !/^[A-Z]{3}$/.test(input.currencyCode.trim().toUpperCase())) {
      throw new BadRequestException('currencyCode must be a 3-letter uppercase code');
    }
    if (input.currencyCode && input.currencyCode.trim().toUpperCase() !== 'YER') {
      throw new BadRequestException('Subscription adjustments must use YER');
    }
    if (input.accountingCategory === 'revenue') {
      if (input.affectsRevenue !== true || input.amount == null) {
        throw new BadRequestException('Revenue adjustments require amount and affectsRevenue=true');
      }
    }
    if (
      input.amount != null &&
      input.affectsRevenue !== true &&
      input.accountingCategory !== 'revenue'
    ) {
      throw new BadRequestException('amount is only allowed for revenue-impacting adjustments');
    }
  }

  private normalizeQuery(query: ListSubscriptionAdjustmentsQueryDto) {
    return {
      page: query.page,
      limit: query.limit,
      operation: query.operation,
      accountingCategory: query.accountingCategory,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    };
  }

  private daysBetween(from: Date | null, to: Date): number | null {
    if (!from) return null;
    return Math.round((to.getTime() - from.getTime()) / 86_400_000);
  }

  private async buildSubscriptionResponse(storeId: string): Promise<StoreSubscriptionResponse> {
    const subscription = await this.saasRepository.getCurrentSubscription(storeId);
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }
    const limits = await this.saasRepository.listPlanLimits(subscription.plan_id);
    const entitlements = await this.saasRepository.listPlanEntitlements(subscription.plan_id);
    const usage: Array<{
      metricKey: string;
      used: number;
      limit: number | null;
      resetPeriod: 'lifetime' | 'monthly';
    }> = [];
    return SaasHelpers.toSubscriptionResponse(subscription, limits, entitlements, usage);
  }

  private toAdjustmentResponse(
    record: SubscriptionAdjustmentRecord,
  ): SubscriptionAdjustmentResponse {
    return {
      id: record.id,
      storeId: record.store_id,
      subscriptionId: record.subscription_id,
      invoiceId: record.invoice_id,
      operation: record.operation,
      accountingCategory: record.accounting_category,
      affectsRevenue: record.affects_revenue,
      amount: record.amount == null ? null : Number(record.amount),
      currencyCode: record.currency_code,
      daysDelta: record.days_delta,
      oldStatus: record.old_status,
      newStatus: record.new_status,
      oldBillingCycle: record.old_billing_cycle,
      newBillingCycle: record.new_billing_cycle,
      oldCurrentPeriodEnd: record.old_current_period_end,
      newCurrentPeriodEnd: record.new_current_period_end,
      oldNextBillingAt: record.old_next_billing_at,
      newNextBillingAt: record.new_next_billing_at,
      oldTrialEndsAt: record.old_trial_ends_at,
      newTrialEndsAt: record.new_trial_ends_at,
      reason: record.reason,
      note: record.note,
      createdByAdminId: record.created_by_admin_id,
      metadata: record.metadata,
      createdAt: record.created_at,
    };
  }
}

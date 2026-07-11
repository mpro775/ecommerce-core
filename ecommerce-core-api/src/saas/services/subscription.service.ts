import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface';
import type { RequestContextData } from '../../common/utils/request-context.util';
import {
  METRIC_DISPLAY_NAMES,
  type LimitResetPeriod,
  type SaasMetricKey,
} from '../constants/saas-metrics.constants';
import type {
  SubscriptionBillingCycle,
  SubscriptionStatus,
} from '../constants/subscription-core.constants';
import type { AssignStorePlanDto } from '../dto/assign-store-plan.dto';
import type { CancelSubscriptionDto } from '../dto/cancel-subscription.dto';
import type { ChangeSubscriptionPlanDto } from '../dto/change-subscription-plan.dto';
import type { ListSubscriptionReceiptsQueryDto } from '../dto/list-subscription-receipts-query.dto';
import type { ReviewSubscriptionReceiptDto } from '../dto/review-subscription-receipt.dto';
import type {
  UpsertSubscriptionCouponDto,
  ValidateSubscriptionCouponDto,
} from '../dto/subscription-coupon.dto';
import type { UpdateSubscriptionSettingsDto } from '../dto/update-subscription-settings.dto';
import type { UploadSubscriptionReceiptDto } from '../dto/upload-subscription-receipt.dto';
import {
  SaasRepository,
  type CurrentSubscriptionRecord,
  type PlanLimitRecord,
  type PlanRecord,
  type SubscriptionCouponRecord,
  type SubscriptionSettingsRecord,
  type SubscriptionInvoiceRecord,
  type SubscriptionPaymentReceiptRecord,
} from '../saas.repository';
import { SaasHelpers } from './helpers';
import type { InvoiceResponse, PlanResponse, StoreSubscriptionResponse } from './types';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);
  private readonly subscriptionCurrencyCode = 'YER';
  private readonly allowedReceiptMimeTypes = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
  ]);
  private readonly maxReceiptSizeBytes = 10 * 1024 * 1024;

  constructor(
    private readonly saasRepository: SaasRepository,
    private readonly auditService: AuditService,
  ) {}

  async ensureDefaultSubscription(storeId: string, ownerId?: string): Promise<void> {
    const current = await this.saasRepository.getCurrentSubscription(storeId);
    if (current) {
      return;
    }

    const settings = await this.saasRepository.getSubscriptionSettings();
    const assignFreePlan = async () => {
      const freeCode = settings.free_plan_code ?? 'free';
      const freePlan = await this.saasRepository.findPlanByCode(freeCode);
      if (!freePlan) {
        throw new NotFoundException('Default free plan is not configured');
      }

      const now = new Date();
      await this.saasRepository.replaceCurrentSubscription({
        storeId,
        planId: freePlan.id,
        status: 'active',
        startsAt: now,
        currentPeriodEnd: null,
        trialEndsAt: null,
        billingCycle: 'monthly',
        nextBillingAt: null,
        cancelAtPeriodEnd: false,
        canceledAt: null,
      });
    };

    if (
      !settings.signup_trial_enabled ||
      !settings.signup_trial_plan_code ||
      settings.signup_trial_days <= 0
    ) {
      await assignFreePlan();
      return;
    }

    if (settings.one_trial_per_store && (await this.saasRepository.hasStoreUsedTrial(storeId))) {
      await assignFreePlan();
      return;
    }

    if (
      ownerId &&
      settings.one_trial_per_owner &&
      (await this.saasRepository.hasOwnerUsedTrial(ownerId))
    ) {
      await assignFreePlan();
      return;
    }

    const trialPlan = await this.saasRepository.findPlanByCode(settings.signup_trial_plan_code);
    if (!trialPlan || !trialPlan.is_active) {
      this.logger.warn(
        `Signup trial plan ${settings.signup_trial_plan_code} is unavailable; assigning free plan`,
      );
      await assignFreePlan();
      return;
    }

    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + settings.signup_trial_days * 86_400_000);
    await this.saasRepository.replaceCurrentSubscription({
      storeId,
      planId: trialPlan.id,
      status: 'trialing',
      startsAt: now,
      currentPeriodEnd: trialEndsAt,
      trialEndsAt,
      billingCycle: 'monthly',
      nextBillingAt: trialEndsAt,
      cancelAtPeriodEnd: false,
      canceledAt: null,
    });
  }

  async getCurrentStoreSubscription(currentUser: AuthUser): Promise<StoreSubscriptionResponse> {
    await this.ensureDefaultSubscription(currentUser.storeId);
    const subscription = await this.requireCurrentSubscription(currentUser.storeId);
    const limits = await this.saasRepository.listPlanLimits(subscription.plan_id);
    const entitlements = await this.saasRepository.listPlanEntitlements(subscription.plan_id);
    const usage = await this.resolveUsageSnapshot(currentUser.storeId, limits, new Date());
    return SaasHelpers.toSubscriptionResponse(subscription, limits, entitlements, usage);
  }

  async getMerchantBillingCenter(currentUser: AuthUser) {
    await this.ensureDefaultSubscription(currentUser.storeId);
    const subscription = await this.requireCurrentSubscription(currentUser.storeId);
    const planLimits = await this.saasRepository.listPlanLimits(subscription.plan_id);
    const [usage, invoices, receipts, plans] = await Promise.all([
      this.resolveUsageSnapshot(currentUser.storeId, planLimits, new Date()),
      this.saasRepository.listInvoicesByStore({
        storeId: currentUser.storeId,
        status: null,
        limit: 10,
        offset: 0,
      }),
      this.saasRepository.listSubscriptionReceipts({
        storeId: currentUser.storeId,
        page: 1,
        limit: 10,
      }),
      this.listStoreAvailablePlans(),
    ]);
    const now = new Date();
    const currentPeriodEnd = subscription.current_period_end;
    const daysRemaining = currentPeriodEnd
      ? Math.max(0, Math.ceil((currentPeriodEnd.getTime() - now.getTime()) / 86_400_000))
      : 0;
    const openInvoice = invoices.rows.find((invoice) => invoice.status === 'open') ?? null;
    const messages: Array<{
      type: 'info' | 'warning' | 'danger' | 'success';
      code: string;
      title: string;
      description: string;
    }> = [];
    if (subscription.status === 'trialing') {
      messages.push({
        type: 'info',
        code: 'trial_active',
        title: 'Trial is active',
        description: `${daysRemaining} days remaining in your trial.`,
      });
    }
    if (subscription.status === 'past_due' || openInvoice) {
      messages.push({
        type: 'warning',
        code: 'invoice_open',
        title: 'Open invoice',
        description: 'You have an open subscription invoice pending payment.',
      });
    }
    if (subscription.status === 'suspended' || subscription.status === 'expired') {
      messages.push({
        type: 'danger',
        code: 'subscription_inactive',
        title: 'Subscription inactive',
        description: 'Your subscription is not active. Pay or contact support to restore service.',
      });
    }

    return {
      subscription: {
        planCode: subscription.plan_code,
        planName: subscription.plan_name,
        status: subscription.status,
        billingCycle: subscription.billing_cycle,
        currentPeriodEnd: subscription.current_period_end,
        nextBillingAt: subscription.next_billing_at,
        daysRemaining,
        renewalAmount: SaasHelpers.computePlanAmount(
          {
            id: subscription.plan_id,
            code: subscription.plan_code,
            name: subscription.plan_name,
            description: subscription.plan_description,
            is_active: subscription.plan_is_active,
            monthly_price: subscription.plan_monthly_price,
            annual_price: subscription.plan_annual_price,
            monthly_compare_at_price: subscription.plan_monthly_compare_at_price,
            annual_compare_at_price: subscription.plan_annual_compare_at_price,
            currency_code: subscription.plan_currency_code,
            billing_cycle_options: [],
            trial_days_default: 0,
            sale_label: subscription.plan_sale_label,
            sale_starts_at: subscription.plan_sale_starts_at,
            sale_ends_at: subscription.plan_sale_ends_at,
            is_intro_offer: subscription.plan_is_intro_offer,
            is_sale_active: subscription.plan_is_sale_active,
            metadata: {},
          },
          subscription.billing_cycle,
        ),
        currencyCode: subscription.plan_currency_code,
      },
      usage: usage.map((item) => {
        const percentage =
          item.limit === null
            ? null
            : Math.min(100, Math.round((item.used / Math.max(1, item.limit)) * 100));
        return {
          key: item.metricKey,
          label: METRIC_DISPLAY_NAMES[item.metricKey as SaasMetricKey] ?? item.metricKey,
          used: item.used,
          limit: item.limit,
          percentage,
          status:
            item.limit !== null && item.used >= item.limit
              ? 'limit_reached'
              : percentage !== null && percentage >= 80
                ? 'warning'
                : 'ok',
        };
      }),
      openInvoice: openInvoice ? SaasHelpers.toInvoiceResponse(openInvoice) : null,
      invoices: invoices.rows.map((invoice) => SaasHelpers.toInvoiceResponse(invoice)),
      receipts: receipts.items.map((receipt) => this.toReceiptResponse(receipt)),
      availablePlans: plans,
      canChangePlan: !['suspended', 'canceled', 'expired'].includes(subscription.status),
      messages,
    };
  }

  async listStoreAvailablePlans(): Promise<PlanResponse[]> {
    const plans = await this.saasRepository.listPlans({ onlyActive: true });
    return Promise.all(plans.map((plan) => this.toPlanResponse(plan)));
  }

  async getSubscriptionSettings() {
    const settings = await this.saasRepository.getSubscriptionSettings();
    return this.toSubscriptionSettingsResponse(settings);
  }

  async updateSubscriptionSettings(input: UpdateSubscriptionSettingsDto) {
    if (input.signupTrialEnabled) {
      if (!input.signupTrialPlanCode) {
        throw new BadRequestException('Signup trial plan is required when trial is enabled');
      }
      if (input.signupTrialDays <= 0) {
        throw new BadRequestException(
          'Signup trial days must be greater than zero when trial is enabled',
        );
      }
      const trialPlan = await this.saasRepository.findPlanByCode(input.signupTrialPlanCode);
      if (!trialPlan || !trialPlan.is_active) {
        throw new BadRequestException('Signup trial plan must be an active plan');
      }
    }

    if (input.freePlanCode) {
      const freePlan = await this.saasRepository.findPlanByCode(input.freePlanCode);
      if (!freePlan) {
        throw new BadRequestException('Free plan is not configured');
      }
    }
    if (input.trialReminderDaysBefore.some((day) => day <= 0)) {
      throw new BadRequestException('Trial reminder days must be positive numbers');
    }

    const saved = await this.saasRepository.updateSubscriptionSettings({
      signupTrialEnabled: input.signupTrialEnabled,
      signupTrialPlanCode: input.signupTrialPlanCode?.trim().toLowerCase() || null,
      signupTrialDays: input.signupTrialDays,
      afterTrialBehavior: input.afterTrialBehavior,
      freePlanCode: input.freePlanCode?.trim().toLowerCase() || null,
      allowTrialPlanChange: input.allowTrialPlanChange,
      oneTrialPerStore: input.oneTrialPerStore,
      oneTrialPerOwner: input.oneTrialPerOwner,
      trialRequiresPaymentMethod: input.trialRequiresPaymentMethod,
      trialReminderDaysBefore: Array.from(new Set(input.trialReminderDaysBefore)).sort(
        (a, b) => b - a,
      ),
    });
    return this.toSubscriptionSettingsResponse(saved);
  }

  async processExpiredTrials(limit = 100): Promise<{ processed: number }> {
    const settings = await this.saasRepository.getSubscriptionSettings();
    const expired = await this.saasRepository.listExpiredTrials(limit);
    let processed = 0;

    for (const row of expired) {
      if (settings.after_trial_behavior === 'downgrade_to_free') {
        const freePlan = await this.saasRepository.findPlanByCode(
          settings.free_plan_code ?? 'free',
        );
        if (!freePlan) {
          this.logger.warn('Cannot downgrade expired trial because free plan is not configured');
          continue;
        }
        await this.saasRepository.replaceCurrentSubscription({
          storeId: row.store_id,
          planId: freePlan.id,
          status: 'active',
          startsAt: new Date(),
          currentPeriodEnd: null,
          trialEndsAt: null,
          billingCycle: 'monthly',
          nextBillingAt: null,
          cancelAtPeriodEnd: false,
          canceledAt: null,
        });
      } else if (settings.after_trial_behavior === 'suspend_paid_features') {
        await this.saasRepository.updateSubscriptionStatus(row.store_id, 'suspended');
      } else {
        await this.saasRepository.updateSubscriptionStatus(row.store_id, 'past_due');
      }
      processed += 1;
    }

    return { processed };
  }

  async listSubscriptionCoupons() {
    const coupons = await this.saasRepository.listSubscriptionCoupons();
    return coupons.map((coupon) => this.toCouponResponse(coupon));
  }

  async getSubscriptionCoupon(couponId: string) {
    const coupon = await this.saasRepository.findSubscriptionCouponById(couponId);
    if (!coupon) {
      throw new NotFoundException('Subscription coupon not found');
    }
    return this.toCouponResponse(coupon);
  }

  async createSubscriptionCoupon(input: UpsertSubscriptionCouponDto) {
    if (!input.code) {
      throw new BadRequestException('Coupon code is required');
    }
    const existing = await this.saasRepository.findSubscriptionCouponByCode(input.code);
    if (existing) {
      throw new BadRequestException('Coupon code already exists');
    }
    this.validateCouponInput(input);
    const coupon = await this.saasRepository.createSubscriptionCoupon(
      this.normalizeCouponInput(input, input.code),
    );
    return this.toCouponResponse(coupon);
  }

  async updateSubscriptionCoupon(couponId: string, input: UpsertSubscriptionCouponDto) {
    const existing = await this.saasRepository.findSubscriptionCouponById(couponId);
    if (!existing) {
      throw new NotFoundException('Subscription coupon not found');
    }
    this.validateCouponInput(input);
    const coupon = await this.saasRepository.updateSubscriptionCoupon(
      couponId,
      this.normalizeCouponInput(input, existing.code),
    );
    if (!coupon) {
      throw new NotFoundException('Subscription coupon not found');
    }
    return this.toCouponResponse(coupon);
  }

  async disableSubscriptionCoupon(couponId: string) {
    const existing = await this.saasRepository.findSubscriptionCouponById(couponId);
    if (!existing) {
      throw new NotFoundException('Subscription coupon not found');
    }
    const coupon = await this.saasRepository.updateSubscriptionCoupon(couponId, {
      name: existing.name,
      description: existing.description,
      discountType: existing.discount_type,
      discountValue: Number(existing.discount_value),
      currencyCode: existing.currency_code,
      durationMonths: existing.duration_months,
      appliesToPlanCodes: existing.applies_to_plan_codes,
      maxRedemptions: existing.max_redemptions,
      maxRedemptionsPerStore: existing.max_redemptions_per_store,
      purpose: existing.purpose,
      accountingCategory: existing.accounting_category,
      affectsRevenue: existing.affects_revenue,
      activatePlanCode: existing.activate_plan_code,
      startsAt: existing.starts_at,
      expiresAt: existing.expires_at,
      isActive: false,
      metadata: existing.metadata ?? {},
    });
    return this.toCouponResponse(coupon as SubscriptionCouponRecord);
  }

  async listSubscriptionCouponRedemptions(couponId: string) {
    const coupon = await this.saasRepository.findSubscriptionCouponById(couponId);
    if (!coupon) {
      throw new NotFoundException('Subscription coupon not found');
    }
    const redemptions = await this.saasRepository.listSubscriptionCouponRedemptions(couponId);
    return redemptions.map((entry) => ({
      id: entry.id,
      couponId: entry.coupon_id,
      storeId: entry.store_id,
      subscriptionId: entry.subscription_id,
      planId: entry.plan_id,
      invoiceId: entry.invoice_id,
      couponCode: entry.coupon_code,
      discountType: entry.discount_type,
      discountValue: Number(entry.discount_value),
      billingCycle: entry.billing_cycle,
      originalAmount: Number(entry.original_amount),
      discountAmount: Number(entry.discount_amount),
      finalAmount: Number(entry.final_amount),
      freeMonths: entry.free_months,
      redeemedAt: entry.redeemed_at,
    }));
  }

  async validateSubscriptionCoupon(currentUser: AuthUser, input: ValidateSubscriptionCouponDto) {
    const plan = await this.requirePlanByCode(input.planCode);
    const coupon = await this.requireUsableCoupon(input.code, currentUser.storeId, plan.code);
    return this.buildCouponQuote(coupon, plan, input.billingCycle);
  }

  async redeemSubscriptionCoupon(
    currentUser: AuthUser,
    input: ValidateSubscriptionCouponDto,
    context: RequestContextData,
  ) {
    const plan = await this.requirePlanByCode(input.planCode);
    const coupon = await this.requireUsableCoupon(input.code, currentUser.storeId, plan.code);
    const quote = this.buildCouponQuote(coupon, plan, input.billingCycle);
    const startsAt = new Date();
    const freeMonths = quote.freeMonths;
    const freeDays = quote.freeDays;
    const nextBillingAt =
      freeMonths > 0
        ? new Date(startsAt.getTime() + freeMonths * 30 * 86_400_000)
        : freeDays > 0
          ? new Date(startsAt.getTime() + freeDays * 86_400_000)
          : SaasHelpers.computeNextBillingAt(startsAt, input.billingCycle);

    const result = await this.saasRepository.withTransaction(async (db) => {
      await this.saasRepository.replaceCurrentSubscription(
        {
          storeId: currentUser.storeId,
          planId: plan.id,
          status: freeMonths > 0 || freeDays > 0 ? 'trialing' : 'active',
          startsAt,
          currentPeriodEnd: nextBillingAt,
          trialEndsAt: freeMonths > 0 || freeDays > 0 ? nextBillingAt : null,
          billingCycle: input.billingCycle,
          nextBillingAt,
          cancelAtPeriodEnd: false,
          canceledAt: null,
        },
        db,
      );

      const subscription = await this.saasRepository.getCurrentSubscriptionForUpdate(
        currentUser.storeId,
        db,
      );
      if (!subscription) {
        throw new NotFoundException('Subscription not found');
      }
      const invoice = await this.saasRepository.createInvoice(
        {
          storeId: currentUser.storeId,
          subscriptionId: subscription.id,
          planId: plan.id,
          invoiceNumber: SaasHelpers.generateInvoiceNumber(),
          billingCycle: input.billingCycle,
          periodStart: startsAt,
          periodEnd: nextBillingAt ?? startsAt,
          subtotalAmount: quote.originalAmount,
          taxAmount: 0,
          totalAmount: quote.finalAmount,
          currencyCode: plan.currency_code,
          status: quote.finalAmount === 0 ? 'paid' : 'open',
          dueAt: quote.finalAmount === 0 ? null : new Date(startsAt.getTime() + 3 * 86_400_000),
          paidAt: quote.finalAmount === 0 ? startsAt : null,
          metadata: {
            couponCode: coupon.code,
            discountAmount: quote.discountAmount,
            originalAmount: quote.originalAmount,
            requestId: context.requestId,
          },
        },
        db,
      );

      const redemption = await this.saasRepository.createSubscriptionCouponRedemption(db, {
        couponId: coupon.id,
        storeId: currentUser.storeId,
        subscriptionId: subscription.id,
        planId: plan.id,
        invoiceId: invoice.id,
        couponCode: coupon.code,
        discountType: coupon.discount_type,
        discountValue: Number(coupon.discount_value),
        billingCycle: input.billingCycle,
        originalAmount: quote.originalAmount,
        discountAmount: quote.discountAmount,
        finalAmount: quote.finalAmount,
        freeMonths,
        metadata: {
          requestId: context.requestId,
          freeDays,
          purpose: coupon.purpose,
          accountingCategory: coupon.accounting_category,
          affectsRevenue: coupon.affects_revenue,
          activatePlanCode: coupon.activate_plan_code,
        },
      });

      await this.saasRepository.createSubscriptionAdjustment(
        {
          storeId: currentUser.storeId,
          subscriptionId: subscription.id,
          invoiceId: invoice.id,
          operation:
            freeMonths > 0
              ? 'marketing_gift'
              : freeDays > 0
                ? 'grant_trial_days'
                : 'manual_correction',
          accountingCategory: coupon.accounting_category,
          affectsRevenue: coupon.affects_revenue,
          amount: quote.discountAmount,
          currencyCode: plan.currency_code,
          daysDelta: freeDays > 0 ? freeDays : freeMonths > 0 ? freeMonths * 30 : null,
          newCurrentPeriodEnd: nextBillingAt,
          newNextBillingAt: nextBillingAt,
          newTrialEndsAt: freeMonths > 0 || freeDays > 0 ? nextBillingAt : null,
          reason: 'Subscription coupon redeemed',
          metadata: { couponId: coupon.id, couponCode: coupon.code, requestId: context.requestId },
        },
        db,
      );

      await this.saasRepository.createBillingEvent(
        {
          storeId: currentUser.storeId,
          source: 'merchant_action',
          eventType: 'subscription_coupon_redeemed',
          idempotencyKey: redemption.id,
          payload: {
            storeId: currentUser.storeId,
            invoiceId: invoice.id,
            couponId: coupon.id,
            code: coupon.code,
            amount: quote.discountAmount,
            currencyCode: plan.currency_code,
            accountingCategory: coupon.accounting_category,
            affectsRevenue: coupon.affects_revenue,
          },
          status: 'processed',
          processedAt: new Date(),
        },
        db,
      );
      return { invoice, redemption };
    });

    return {
      quote,
      invoice: SaasHelpers.toInvoiceResponse(result.invoice),
      redemptionId: result.redemption.id,
    };
  }

  async uploadSubscriptionReceipt(
    currentUser: AuthUser,
    input: UploadSubscriptionReceiptDto,
    context: RequestContextData,
  ) {
    const currencyCode = input.currencyCode?.trim().toUpperCase() || this.subscriptionCurrencyCode;
    if (currencyCode !== this.subscriptionCurrencyCode) {
      throw new BadRequestException('Subscription receipts must use YER');
    }
    const transactionReference = input.transactionReference?.trim();
    if (!transactionReference) {
      throw new BadRequestException('transactionReference is required');
    }
    if (!input.receiptMediaId && !input.receiptUrl?.trim()) {
      throw new BadRequestException('Receipt file is required');
    }

    const receipt = await this.saasRepository.withTransaction(async (db) => {
      const invoice = await this.saasRepository.findSubscriptionInvoiceForUpdate(
        input.invoiceId,
        db,
      );
      if (!invoice || invoice.store_id !== currentUser.storeId) {
        throw new NotFoundException('Invoice not found');
      }
      if (invoice.currency_code !== this.subscriptionCurrencyCode) {
        throw new BadRequestException('Invoice currency must be YER before receipt upload');
      }
      if (invoice.status !== 'open' && invoice.status !== 'failed') {
        throw new BadRequestException('Only open or failed invoices can receive payment receipts');
      }
      if (await this.saasRepository.hasPendingSubscriptionReceiptForInvoice(invoice.id, db)) {
        throw new BadRequestException('Invoice already has a receipt pending review');
      }

      const mediaAsset = input.receiptMediaId
        ? await this.saasRepository.findSubscriptionReceiptMediaAsset(
            currentUser.storeId,
            input.receiptMediaId,
            db,
          )
        : null;
      if (input.receiptMediaId && !mediaAsset) {
        throw new NotFoundException('Receipt media asset not found');
      }
      const receiptMimeType = mediaAsset?.mime_type ?? input.receiptMimeType?.trim() ?? null;
      const receiptSizeBytes = mediaAsset?.file_size_bytes ?? input.receiptSizeBytes ?? null;
      if (receiptMimeType && !this.allowedReceiptMimeTypes.has(receiptMimeType)) {
        throw new BadRequestException('Receipt file must be JPG, PNG, WEBP, or PDF');
      }
      if (receiptSizeBytes !== null && receiptSizeBytes > this.maxReceiptSizeBytes) {
        throw new BadRequestException('Receipt file is larger than 10MB');
      }
      const fileNameFromMetadata =
        mediaAsset?.metadata && typeof mediaAsset.metadata.fileName === 'string'
          ? mediaAsset.metadata.fileName
          : null;

      const created = await this.saasRepository.createSubscriptionReceipt(
        {
          storeId: currentUser.storeId,
          subscriptionId: invoice.subscription_id,
          invoiceId: invoice.id,
          paymentMethodId: input.paymentMethodId ?? null,
          paymentMethodCode: input.paymentMethodCode?.trim() || null,
          paymentMethodName: input.paymentMethodName?.trim() || null,
          amount: input.amount,
          currencyCode,
          transactionReference,
          paidAt: input.paidAt ? new Date(input.paidAt) : null,
          receiptMediaId: input.receiptMediaId ?? null,
          receiptUrl: mediaAsset?.public_url ?? input.receiptUrl?.trim() ?? null,
          receiptFileName: input.receiptFileName?.trim() || fileNameFromMetadata,
          receiptMimeType,
          receiptSizeBytes,
          merchantNote: input.merchantNote?.trim() || null,
          createdByUserId: currentUser.id,
          metadata: { invoiceNumber: invoice.invoice_number, requestId: context.requestId },
        },
        db,
      );

      await this.saasRepository.createBillingEvent(
        {
          storeId: currentUser.storeId,
          source: 'merchant_action',
          eventType: 'subscription_receipt_uploaded',
          idempotencyKey: created.id,
          payload: {
            storeId: currentUser.storeId,
            invoiceId: invoice.id,
            receiptId: created.id,
            amount: input.amount,
            currencyCode,
            receiptMediaId: created.receipt_media_id,
          },
          status: 'processed',
          processedAt: new Date(),
        },
        db,
      );

      await this.auditService.log(
        {
          action: 'billing.subscription_receipt_uploaded',
          storeId: currentUser.storeId,
          storeUserId: currentUser.id,
          targetType: 'subscription_payment_receipt',
          targetId: created.id,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          metadata: {
            requestId: context.requestId,
            invoiceId: invoice.id,
            amount: input.amount,
            currencyCode,
          },
        },
        db,
      );

      return created;
    });

    return this.toReceiptResponse(receipt);
  }

  async listStoreSubscriptionReceipts(
    currentUser: AuthUser,
    query: ListSubscriptionReceiptsQueryDto,
  ) {
    const result = await this.saasRepository.listSubscriptionReceipts({
      ...query,
      storeId: currentUser.storeId,
    });
    return {
      ...result,
      items: result.items.map((receipt) => this.toReceiptResponse(receipt)),
    };
  }

  async listPlatformSubscriptionReceipts(query: ListSubscriptionReceiptsQueryDto) {
    const result = await this.saasRepository.listSubscriptionReceipts(query);
    return {
      ...result,
      items: result.items.map((receipt) => this.toReceiptResponse(receipt)),
    };
  }

  async reviewSubscriptionReceipt(
    receiptId: string,
    input: ReviewSubscriptionReceiptDto,
    admin: { id: string },
    context: RequestContextData,
  ) {
    const adminNote = input.adminNote?.trim() || null;
    const rejectionReason = input.rejectionReason?.trim() || null;
    if (input.decision === 'rejected' && !rejectionReason) {
      throw new BadRequestException('Rejection reason is required');
    }

    const result = await this.saasRepository.withTransaction(async (db) => {
      const receipt = await this.saasRepository.findSubscriptionReceiptByIdForUpdate(receiptId, db);
      if (!receipt) {
        throw new NotFoundException('Receipt not found');
      }
      if (receipt.status !== 'pending_review') {
        throw new BadRequestException('Receipt is not pending review');
      }

      const invoice = await this.saasRepository.findSubscriptionInvoiceForUpdate(
        receipt.invoice_id,
        db,
      );
      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }

      if (input.decision === 'rejected') {
        const reviewed = await this.saasRepository.markSubscriptionReceiptReviewed(db, {
          receiptId,
          status: 'rejected',
          reviewedByAdminId: admin.id,
          adminNote,
          rejectionReason,
          metadata: { requestId: context.requestId },
        });
        await this.saasRepository.createBillingEvent(
          {
            storeId: receipt.store_id,
            source: 'internal_admin',
            eventType: 'subscription_receipt_rejected',
            idempotencyKey: `${receiptId}:rejected`,
            payload: {
              storeId: receipt.store_id,
              invoiceId: receipt.invoice_id,
              receiptId,
              reason: rejectionReason,
            },
            status: 'processed',
            processedAt: new Date(),
          },
          db,
        );
        await this.auditService.log(
          {
            action: 'platform.subscription_receipt_rejected',
            storeId: reviewed.store_id,
            storeUserId: null,
            targetType: 'subscription_payment_receipt',
            targetId: receiptId,
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
            metadata: {
              requestId: context.requestId,
              decision: input.decision,
              invoiceId: reviewed.invoice_id,
              amount: Number(reviewed.amount),
              rejectionReason,
            },
          },
          db,
        );
        return { receipt: reviewed, invoice };
      }

      if (invoice.status === 'paid') {
        throw new BadRequestException('Invoice is already paid');
      }
      if (invoice.status === 'void' || invoice.status === 'refunded') {
        throw new BadRequestException(`Invoice status ${invoice.status} cannot be settled`);
      }
      if (await this.saasRepository.hasApprovedSubscriptionReceiptForInvoice(invoice.id, db)) {
        throw new BadRequestException('Invoice already has an approved receipt');
      }

      const paidAt = receipt.paid_at ?? new Date();
      const payment = await this.saasRepository.createPayment(
        {
          invoiceId: invoice.id,
          storeId: invoice.store_id,
          provider: 'manual_receipt',
          paymentMethod: receipt.payment_method_code ?? receipt.payment_method_name ?? 'manual',
          status: 'succeeded',
          amount: Number(receipt.amount),
          currencyCode: receipt.currency_code,
          externalTransactionId: receipt.transaction_reference,
          processedAt: paidAt,
          metadata: { receiptId: receipt.id, requestId: context.requestId },
        },
        db,
      );

      await this.saasRepository.updateInvoiceStatus(
        {
          invoiceId: invoice.id,
          status: 'paid',
          paidAt,
          metadata: {
            ...invoice.metadata,
            paidByReceiptId: receipt.id,
            manualReceiptApprovedAt: new Date().toISOString(),
          },
        },
        db,
      );

      await this.saasRepository.updateSubscriptionStatus(invoice.store_id, 'active', db);
      await this.saasRepository.setStoreSuspension(
        {
          storeId: invoice.store_id,
          isSuspended: false,
          reason: null,
        },
        db,
      );

      const current = await this.saasRepository.getCurrentSubscriptionForUpdate(
        invoice.store_id,
        db,
      );
      if (current) {
        const oldPeriodEnd = current.current_period_end;
        const oldNextBillingAt = current.next_billing_at;
        const periodEnd = invoice.period_end;
        await this.saasRepository.updateCurrentSubscriptionBilling(
          {
            storeId: invoice.store_id,
            currentPeriodEnd: periodEnd,
            nextBillingAt: periodEnd,
            trialEndsAt: null,
            cancelAtPeriodEnd: false,
          },
          db,
        );
        await this.saasRepository.createSubscriptionAdjustment(
          {
            storeId: invoice.store_id,
            subscriptionId: current.id,
            invoiceId: invoice.id,
            operation: 'mark_paid_until',
            accountingCategory: 'revenue',
            affectsRevenue: true,
            amount: Number(receipt.amount),
            currencyCode: receipt.currency_code,
            oldStatus: current.status,
            newStatus: 'active',
            oldCurrentPeriodEnd: oldPeriodEnd,
            newCurrentPeriodEnd: periodEnd,
            oldNextBillingAt,
            newNextBillingAt: periodEnd,
            reason: 'Subscription payment receipt approved',
            createdByAdminId: admin.id,
            metadata: {
              receiptId: receipt.id,
              paymentId: payment.id,
              requestId: context.requestId,
            },
          },
          db,
        );
      }

      const reviewed = await this.saasRepository.markSubscriptionReceiptReviewed(db, {
        receiptId,
        status: 'approved',
        paymentId: payment.id,
        reviewedByAdminId: admin.id,
        adminNote,
        metadata: { requestId: context.requestId },
      });

      await this.saasRepository.createBillingEvent(
        {
          storeId: receipt.store_id,
          source: 'internal_admin',
          eventType: 'subscription_receipt_approved',
          idempotencyKey: `${receiptId}:approved`,
          payload: {
            storeId: receipt.store_id,
            invoiceId: receipt.invoice_id,
            receiptId,
            paymentId: payment.id,
            amount: Number(receipt.amount),
            currencyCode: receipt.currency_code,
            accountingCategory: 'revenue',
            affectsRevenue: true,
          },
          status: 'processed',
          processedAt: new Date(),
        },
        db,
      );

      await this.saasRepository.createBillingEvent(
        {
          storeId: receipt.store_id,
          source: 'internal_admin',
          eventType: 'subscription_payment_recorded',
          idempotencyKey: payment.id,
          payload: {
            storeId: receipt.store_id,
            invoiceId: receipt.invoice_id,
            receiptId,
            paymentId: payment.id,
            amount: Number(receipt.amount),
            currencyCode: receipt.currency_code,
          },
          status: 'processed',
          processedAt: new Date(),
        },
        db,
      );

      await this.auditService.log(
        {
          action: 'platform.subscription_receipt_approved',
          storeId: reviewed.store_id,
          storeUserId: null,
          targetType: 'subscription_payment_receipt',
          targetId: receiptId,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          metadata: {
            requestId: context.requestId,
            decision: input.decision,
            invoiceId: reviewed.invoice_id,
            amount: Number(reviewed.amount),
          },
        },
        db,
      );

      return { receipt: reviewed, invoice };
    });

    return this.toReceiptResponse(result.receipt);
  }

  async getSubscriptionAnalytics() {
    const row = await this.saasRepository.getSubscriptionAnalytics();
    return {
      actualMrr: Number(row.actual_mrr),
      trialPipelineMrr: Number(row.trial_pipeline_mrr),
      trialStoresCount: Number(row.trial_stores_count),
      trialConversionRate: Number(row.trial_conversion_rate),
      expiringTrials7Days: Number(row.expiring_trials_7_days),
      expiredNotConverted: Number(row.expired_not_converted),
      couponMrrImpact: Number(row.coupon_mrr_impact),
    };
  }

  async assignStorePlan(
    storeId: string,
    input: AssignStorePlanDto,
    context: RequestContextData,
  ): Promise<StoreSubscriptionResponse> {
    const plan = await this.saasRepository.findPlanByCode(input.planCode.trim().toLowerCase());
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    const status = input.status ?? (input.trialDays ? 'trialing' : 'active');
    if (status === 'trialing' && (!input.trialDays || input.trialDays <= 0)) {
      throw new BadRequestException('trialDays is required when assigning a trialing subscription');
    }
    const startsAt = new Date();
    const billingCycle = input.billingCycle ?? 'monthly';
    this.assertBillingCycleAllowed(plan, billingCycle);
    const period = this.resolveSubscriptionPeriod({
      plan,
      status,
      billingCycle,
      startsAt,
      trialDays: input.trialDays,
    });

    await this.saasRepository.replaceCurrentSubscription({
      storeId,
      planId: plan.id,
      status,
      startsAt,
      currentPeriodEnd: period.currentPeriodEnd,
      trialEndsAt: period.trialEndsAt,
      billingCycle,
      nextBillingAt: period.nextBillingAt,
      cancelAtPeriodEnd: false,
      canceledAt: status === 'canceled' ? startsAt : null,
    });

    await this.auditService.log({
      action: 'platform.subscription_assigned',
      storeId,
      storeUserId: null,
      targetType: 'store_subscription',
      targetId: storeId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        requestId: context.requestId,
        planCode: plan.code,
        status,
        billingCycle,
      },
    });

    const subscription = await this.requireCurrentSubscription(storeId);
    const limits = await this.saasRepository.listPlanLimits(subscription.plan_id);
    const entitlements = await this.saasRepository.listPlanEntitlements(subscription.plan_id);
    const usage = await this.resolveUsageSnapshot(storeId, limits, new Date());
    return SaasHelpers.toSubscriptionResponse(subscription, limits, entitlements, usage);
  }

  async changeCurrentStorePlan(
    currentUser: AuthUser,
    input: ChangeSubscriptionPlanDto,
    context: RequestContextData,
    mode: 'upgrade' | 'downgrade',
  ): Promise<{ subscription: StoreSubscriptionResponse; invoice: InvoiceResponse | null }> {
    const subscription = await this.requireCurrentSubscriptionWithDefaults(currentUser.storeId);
    const currentPlan = await this.requirePlanById(subscription.plan_id);
    const targetPlan = await this.requirePlanByCode(input.targetPlanCode);
    if (targetPlan.id === currentPlan.id) {
      throw new BadRequestException('Target plan is already active');
    }

    if (mode === 'downgrade') {
      const downgradeCheck = await this.canDowngradePlan(currentUser.storeId, targetPlan.code);
      if (!downgradeCheck.canDowngrade) {
        throw new UnprocessableEntityException({
          message: 'Cannot downgrade due to current usage conflicts',
          conflicts: downgradeCheck.conflicts,
        });
      }
    }

    const startsAt = new Date();
    const billingCycle = input.billingCycle ?? subscription.billing_cycle;
    this.assertBillingCycleAllowed(targetPlan, billingCycle);
    const period = this.resolveSubscriptionPeriod({
      plan: targetPlan,
      status: 'active',
      billingCycle,
      startsAt,
    });

    await this.saasRepository.replaceCurrentSubscription({
      storeId: currentUser.storeId,
      planId: targetPlan.id,
      status: 'active',
      startsAt,
      currentPeriodEnd: period.currentPeriodEnd,
      trialEndsAt: null,
      billingCycle,
      nextBillingAt: period.nextBillingAt,
      cancelAtPeriodEnd: false,
      canceledAt: null,
    });

    let invoice: SubscriptionInvoiceRecord | null = null;
    const prorationMode = input.prorationMode ?? 'immediate_invoice';
    if (prorationMode !== 'none') {
      const amount = SaasHelpers.computePlanAmount(targetPlan, billingCycle);
      const credit = SaasHelpers.computeProrationCredit(subscription, currentPlan, startsAt);
      const subtotalAmount = Math.max(0, amount - credit);
      const invoiceStatus = subtotalAmount === 0 ? 'paid' : 'open';

      invoice = await this.saasRepository.createInvoice({
        storeId: currentUser.storeId,
        subscriptionId: (await this.requireCurrentSubscription(currentUser.storeId)).id,
        planId: targetPlan.id,
        invoiceNumber: SaasHelpers.generateInvoiceNumber(),
        billingCycle: mode === 'upgrade' ? 'proration' : billingCycle,
        periodStart: startsAt,
        periodEnd: period.currentPeriodEnd ?? startsAt,
        subtotalAmount,
        taxAmount: 0,
        totalAmount: subtotalAmount,
        currencyCode: targetPlan.currency_code,
        status: invoiceStatus,
        dueAt: subtotalAmount === 0 ? null : new Date(startsAt.getTime() + 3 * 86_400_000),
        paidAt: subtotalAmount === 0 ? startsAt : null,
        metadata: {
          mode,
          prorationMode,
          targetPlanCode: targetPlan.code,
          previousPlanCode: currentPlan.code,
          creditApplied: Number(credit.toFixed(2)),
        },
      });

      if (subtotalAmount === 0) {
        await this.saasRepository.createPayment({
          invoiceId: invoice.id,
          storeId: currentUser.storeId,
          provider: 'internal',
          paymentMethod: 'credit_balance',
          status: 'succeeded',
          amount: 0,
          currencyCode: targetPlan.currency_code,
          processedAt: startsAt,
          metadata: {
            autoSettled: true,
          },
        });
      }
    }

    await this.saasRepository.createBillingEvent({
      storeId: currentUser.storeId,
      source: 'merchant_action',
      eventType: mode === 'upgrade' ? 'subscription.upgraded' : 'subscription.downgraded',
      idempotencyKey: null,
      payload: {
        previousPlan: currentPlan.code,
        targetPlan: targetPlan.code,
        billingCycle,
        invoiceId: invoice?.id ?? null,
      },
      status: 'processed',
      processedAt: startsAt,
    });

    await this.auditService.log({
      action:
        mode === 'upgrade'
          ? 'billing.subscription_upgrade_requested'
          : 'billing.subscription_downgrade_requested',
      storeId: currentUser.storeId,
      storeUserId: currentUser.id,
      targetType: 'store_subscription',
      targetId: currentUser.storeId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        requestId: context.requestId,
        previousPlanCode: currentPlan.code,
        targetPlanCode: targetPlan.code,
        invoiceId: invoice?.id ?? null,
      },
    });

    const freshSubscription = await this.getCurrentStoreSubscription(currentUser);
    return {
      subscription: freshSubscription,
      invoice: invoice ? SaasHelpers.toInvoiceResponse(invoice) : null,
    };
  }

  async cancelSubscription(
    storeId: string,
    context: RequestContextData,
  ): Promise<StoreSubscriptionResponse> {
    await this.ensureDefaultSubscription(storeId);
    const subscription = await this.requireCurrentSubscription(storeId);

    if (subscription.status === 'canceled') {
      throw new BadRequestException('Subscription is already canceled');
    }

    await this.saasRepository.updateSubscriptionStatus(storeId, 'canceled');
    await this.saasRepository.updateCurrentSubscriptionBilling({
      storeId,
      cancelAtPeriodEnd: false,
      canceledAt: new Date(),
      nextBillingAt: null,
    });

    await this.auditService.log({
      action: 'platform.subscription_canceled',
      storeId,
      storeUserId: null,
      targetType: 'store_subscription',
      targetId: storeId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        requestId: context.requestId,
        previousStatus: subscription.status,
      },
    });

    const fresh = await this.requireCurrentSubscription(storeId);
    const limits = await this.saasRepository.listPlanLimits(fresh.plan_id);
    const entitlements = await this.saasRepository.listPlanEntitlements(fresh.plan_id);
    const usage = await this.resolveUsageSnapshot(storeId, limits, new Date());
    return SaasHelpers.toSubscriptionResponse(fresh, limits, entitlements, usage);
  }

  async requestMerchantCancellation(
    currentUser: AuthUser,
    input: CancelSubscriptionDto,
    context: RequestContextData,
  ): Promise<StoreSubscriptionResponse> {
    await this.ensureDefaultSubscription(currentUser.storeId);
    const subscription = await this.requireCurrentSubscription(currentUser.storeId);
    if (subscription.status === 'canceled') {
      throw new BadRequestException('Subscription is already canceled');
    }

    const cancelAtPeriodEnd = input.cancelAtPeriodEnd ?? true;
    if (cancelAtPeriodEnd) {
      await this.saasRepository.updateCurrentSubscriptionBilling({
        storeId: currentUser.storeId,
        cancelAtPeriodEnd: true,
      });
    } else {
      await this.saasRepository.updateSubscriptionStatus(currentUser.storeId, 'canceled');
      await this.saasRepository.updateCurrentSubscriptionBilling({
        storeId: currentUser.storeId,
        cancelAtPeriodEnd: false,
        canceledAt: new Date(),
        nextBillingAt: null,
      });
    }

    await this.auditService.log({
      action: 'billing.subscription_cancel_requested',
      storeId: currentUser.storeId,
      storeUserId: currentUser.id,
      targetType: 'store_subscription',
      targetId: subscription.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        requestId: context.requestId,
        cancelAtPeriodEnd,
      },
    });

    const fresh = await this.requireCurrentSubscription(currentUser.storeId);
    const limits = await this.saasRepository.listPlanLimits(fresh.plan_id);
    const entitlements = await this.saasRepository.listPlanEntitlements(fresh.plan_id);
    const usage = await this.resolveUsageSnapshot(currentUser.storeId, limits, new Date());
    return SaasHelpers.toSubscriptionResponse(fresh, limits, entitlements, usage);
  }

  async suspendSubscription(
    storeId: string,
    reason: string | null,
    context: RequestContextData,
  ): Promise<StoreSubscriptionResponse> {
    await this.ensureDefaultSubscription(storeId);
    const subscription = await this.requireCurrentSubscription(storeId);

    if (subscription.status === 'suspended') {
      throw new BadRequestException('Subscription is already suspended');
    }

    await this.saasRepository.updateSubscriptionStatus(storeId, 'suspended');
    await this.saasRepository.setStoreSuspension({
      storeId,
      isSuspended: true,
      reason: reason ?? 'Subscription suspended',
    });

    await this.auditService.log({
      action: 'platform.subscription_suspended',
      storeId,
      storeUserId: null,
      targetType: 'store_subscription',
      targetId: storeId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        requestId: context.requestId,
        previousStatus: subscription.status,
        reason,
      },
    });

    const fresh = await this.requireCurrentSubscription(storeId);
    const limits = await this.saasRepository.listPlanLimits(fresh.plan_id);
    const entitlements = await this.saasRepository.listPlanEntitlements(fresh.plan_id);
    const usage = await this.resolveUsageSnapshot(storeId, limits, new Date());
    return SaasHelpers.toSubscriptionResponse(fresh, limits, entitlements, usage);
  }

  async resumeSubscription(
    storeId: string,
    context: RequestContextData,
  ): Promise<StoreSubscriptionResponse> {
    await this.ensureDefaultSubscription(storeId);
    const subscription = await this.requireCurrentSubscription(storeId);

    if (
      subscription.status !== 'suspended' &&
      subscription.status !== 'canceled' &&
      subscription.status !== 'past_due'
    ) {
      throw new BadRequestException('Subscription is not suspended, canceled, or past_due');
    }

    await this.saasRepository.updateSubscriptionStatus(storeId, 'active');
    await this.saasRepository.setStoreSuspension({
      storeId,
      isSuspended: false,
      reason: null,
    });

    await this.auditService.log({
      action: 'platform.subscription_resumed',
      storeId,
      storeUserId: null,
      targetType: 'store_subscription',
      targetId: storeId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        requestId: context.requestId,
        previousStatus: subscription.status,
      },
    });

    const fresh = await this.requireCurrentSubscription(storeId);
    const limits = await this.saasRepository.listPlanLimits(fresh.plan_id);
    const entitlements = await this.saasRepository.listPlanEntitlements(fresh.plan_id);
    const usage = await this.resolveUsageSnapshot(storeId, limits, new Date());
    return SaasHelpers.toSubscriptionResponse(fresh, limits, entitlements, usage);
  }

  async canDowngradePlan(
    storeId: string,
    targetPlanCode: string,
  ): Promise<{
    canDowngrade: boolean;
    conflicts: Array<{ metricKey: string; displayName: string; used: number; limit: number }>;
  }> {
    const subscription = await this.requireCurrentSubscription(storeId);
    await this.requirePlanById(subscription.plan_id);
    const targetPlan = await this.requirePlanByCode(targetPlanCode);
    const targetLimits = await this.saasRepository.listPlanLimits(targetPlan.id);

    const conflicts: Array<{
      metricKey: string;
      displayName: string;
      used: number;
      limit: number;
    }> = [];
    const now = new Date();

    for (const targetLimit of targetLimits) {
      if (targetLimit.metric_limit === null) continue;
      const used = await this.resolveMetricUsage(
        storeId,
        targetLimit.metric_key,
        targetLimit.reset_period,
        now,
      );

      if (used > targetLimit.metric_limit) {
        conflicts.push({
          metricKey: targetLimit.metric_key,
          displayName:
            METRIC_DISPLAY_NAMES[targetLimit.metric_key as SaasMetricKey] ?? targetLimit.metric_key,
          used,
          limit: targetLimit.metric_limit,
        });
      }
    }

    return {
      canDowngrade: conflicts.length === 0,
      conflicts,
    };
  }

  async assertStoreIsActive(storeId: string): Promise<void> {
    const suspended = await this.saasRepository.isStoreSuspended(storeId);
    if (suspended) {
      throw new BadRequestException('Store is suspended');
    }
  }

  async requireCurrentSubscriptionWithDefaults(
    storeId: string,
  ): Promise<CurrentSubscriptionRecord> {
    await this.ensureDefaultSubscription(storeId);
    return this.requireCurrentSubscription(storeId);
  }

  async requireCurrentSubscription(storeId: string): Promise<CurrentSubscriptionRecord> {
    const subscription = await this.saasRepository.getCurrentSubscription(storeId);
    if (!subscription) {
      throw new NotFoundException('Store subscription not found');
    }

    if (!subscription.plan_is_active) {
      throw new UnprocessableEntityException('Current plan is inactive');
    }

    return subscription;
  }

  async requirePlanByCode(planCode: string): Promise<PlanRecord> {
    const plan = await this.saasRepository.findPlanByCode(planCode.trim().toLowerCase());
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }
    if (!plan.is_active) {
      throw new UnprocessableEntityException('Target plan is inactive');
    }
    return plan;
  }

  private async requirePlanById(planId: string): Promise<PlanRecord> {
    const plan = await this.saasRepository.findPlanById(planId);
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }
    return plan;
  }

  async resolveUsageSnapshot(
    storeId: string,
    limits: PlanLimitRecord[],
    at: Date,
  ): Promise<
    Array<{ metricKey: string; used: number; limit: number | null; resetPeriod: LimitResetPeriod }>
  > {
    const usage = [] as Array<{
      metricKey: string;
      used: number;
      limit: number | null;
      resetPeriod: LimitResetPeriod;
    }>;

    for (const limit of limits) {
      const used = await this.resolveMetricUsage(storeId, limit.metric_key, limit.reset_period, at);
      usage.push({
        metricKey: limit.metric_key,
        used,
        limit: limit.metric_limit,
        resetPeriod: limit.reset_period,
      });
    }

    return usage;
  }

  async resolveMetricUsage(
    storeId: string,
    metricKey: string,
    _resetPeriod: LimitResetPeriod,
    at: Date,
  ): Promise<number> {
    if (metricKey === 'products.total') {
      return this.saasRepository.countProducts(storeId);
    }

    if (metricKey === 'orders.monthly') {
      return this.saasRepository.countOrdersForMonth(storeId, at);
    }

    if (metricKey === 'staff.total') {
      return this.saasRepository.countStaff(storeId);
    }

    if (metricKey === 'domains.total') {
      return this.saasRepository.countDomains(storeId);
    }

    if (metricKey === 'storage.used') {
      const bytes = await this.saasRepository.getStorageUsedBytes(storeId);
      return Math.ceil(bytes / (1024 * 1024));
    }

    if (metricKey === 'api_calls.monthly') {
      return this.saasRepository.countApiCallsForMonth(storeId, at);
    }

    if (metricKey === 'webhooks.monthly') {
      return this.saasRepository.countWebhooksForMonth(storeId, at);
    }

    return 0;
  }

  async assertSubscriptionStatusAllowsUsage(
    storeId: string,
    status: string,
    trialEndsAt: Date | null,
    now: Date,
  ): Promise<void> {
    if (status === 'trialing' && trialEndsAt && trialEndsAt.getTime() < now.getTime()) {
      await this.saasRepository.updateSubscriptionStatus(storeId, 'past_due');
      await this.saasRepository.setStoreSuspension({
        storeId,
        isSuspended: true,
        reason: 'Trial expired',
      });
      throw new UnprocessableEntityException({
        code: 'SUBSCRIPTION_NOT_ACTIVE',
        status: 'past_due',
        message: 'Trial period has expired. Upgrade plan to continue.',
      });
    }

    if (status === 'canceled' || status === 'suspended' || status === 'past_due') {
      throw new UnprocessableEntityException({
        code: 'SUBSCRIPTION_NOT_ACTIVE',
        status,
        message: `Subscription status ${status} does not allow this operation`,
      });
    }
  }

  async assertStoreStatusAllowsFeatureUsage(storeId: string): Promise<void> {
    const subscription = await this.requireCurrentSubscriptionWithDefaults(storeId);
    await this.assertSubscriptionStatusAllowsUsage(
      storeId,
      subscription.status,
      subscription.trial_ends_at,
      new Date(),
    );
  }

  private validateCouponInput(input: UpsertSubscriptionCouponDto): void {
    const currencyCode = input.currencyCode?.trim().toUpperCase() || this.subscriptionCurrencyCode;
    if (currencyCode !== this.subscriptionCurrencyCode) {
      throw new BadRequestException('Subscription coupons must use YER');
    }
    if (input.discountType === 'percent' && input.discountValue > 100) {
      throw new BadRequestException('Percent coupon cannot exceed 100');
    }
    if (
      input.startsAt &&
      input.expiresAt &&
      new Date(input.expiresAt) <= new Date(input.startsAt)
    ) {
      throw new BadRequestException('Coupon expiry must be after start date');
    }
    if (
      (input.discountType === 'free_months' || input.discountType === 'free_days') &&
      !Number.isInteger(input.discountValue)
    ) {
      throw new BadRequestException('Free duration coupon value must be a whole number');
    }
    if (input.discountType === 'activate_plan' && !input.activatePlanCode?.trim()) {
      throw new BadRequestException('Activation plan code is required');
    }
  }

  private normalizeCouponInput(input: UpsertSubscriptionCouponDto, code: string) {
    return {
      code: code.trim().toUpperCase(),
      name: input.name.trim(),
      description: input.description?.trim() || null,
      discountType: input.discountType,
      discountValue: input.discountValue,
      currencyCode: input.currencyCode?.trim().toUpperCase() || this.subscriptionCurrencyCode,
      durationMonths: input.durationMonths ?? 1,
      appliesToPlanCodes: (input.appliesToPlanCodes ?? [])
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
      purpose:
        input.purpose ?? (input.discountType === 'activate_plan' ? 'activation' : 'discount'),
      accountingCategory:
        input.accountingCategory ??
        (input.discountType === 'percent' || input.discountType === 'fixed'
          ? 'coupon_discount'
          : 'marketing_gift'),
      affectsRevenue:
        input.affectsRevenue ??
        (input.discountType === 'percent' || input.discountType === 'fixed'),
      activatePlanCode: input.activatePlanCode?.trim().toLowerCase() || null,
      maxRedemptions: input.maxRedemptions ?? null,
      maxRedemptionsPerStore: input.maxRedemptionsPerStore ?? null,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      isActive: input.isActive ?? true,
      metadata: {},
    };
  }

  private async requireUsableCoupon(
    code: string,
    storeId: string,
    planCode: string,
  ): Promise<SubscriptionCouponRecord> {
    const coupon = await this.saasRepository.findSubscriptionCouponByCode(
      code.trim().toUpperCase(),
    );
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }
    const now = new Date();
    if (!coupon.is_active) {
      throw new BadRequestException('Coupon is not active');
    }
    if (coupon.starts_at && coupon.starts_at > now) {
      throw new BadRequestException('Coupon is not active yet');
    }
    if (coupon.expires_at && coupon.expires_at < now) {
      throw new BadRequestException('Coupon expired');
    }
    if (coupon.max_redemptions !== null && coupon.redeemed_count >= coupon.max_redemptions) {
      throw new BadRequestException('Coupon redemption limit reached');
    }
    if (
      coupon.applies_to_plan_codes.length > 0 &&
      !coupon.applies_to_plan_codes
        .map((item) => item.toLowerCase())
        .includes(planCode.toLowerCase())
    ) {
      throw new BadRequestException('Coupon does not apply to this plan');
    }
    if (
      coupon.discount_type === 'activate_plan' &&
      coupon.activate_plan_code?.toLowerCase() !== planCode.toLowerCase()
    ) {
      throw new BadRequestException('activate_plan coupon can only activate its linked plan');
    }
    if (coupon.max_redemptions_per_store !== null) {
      const storeUses = await this.saasRepository.countSubscriptionCouponRedemptionsForStore(
        coupon.id,
        storeId,
      );
      if (storeUses >= coupon.max_redemptions_per_store) {
        throw new BadRequestException('Coupon store redemption limit reached');
      }
    }
    return coupon;
  }

  private buildCouponQuote(
    coupon: SubscriptionCouponRecord,
    plan: PlanRecord,
    billingCycle: 'monthly' | 'annual',
  ) {
    const originalAmount = SaasHelpers.computePlanAmount(plan, billingCycle);
    const couponValue = Number(coupon.discount_value);
    let discountAmount = 0;
    let freeMonths = 0;
    let freeDays = 0;

    if (coupon.discount_type === 'percent') {
      discountAmount = Number(((originalAmount * couponValue) / 100).toFixed(2));
    } else if (coupon.discount_type === 'fixed') {
      discountAmount = Math.min(originalAmount, couponValue);
    } else if (coupon.discount_type === 'free_days') {
      freeDays = Math.max(1, Math.floor(couponValue));
      discountAmount = originalAmount;
    } else if (coupon.discount_type === 'free_months') {
      freeMonths = Math.max(1, Math.floor(couponValue));
      discountAmount = originalAmount;
    } else {
      freeMonths = Math.max(1, coupon.duration_months);
      discountAmount = originalAmount;
    }

    const finalAmount = Math.max(0, Number((originalAmount - discountAmount).toFixed(2)));
    return {
      couponId: coupon.id,
      couponCode: coupon.code,
      discountType: coupon.discount_type,
      discountValue: couponValue,
      durationMonths: coupon.duration_months,
      billingCycle,
      planCode: plan.code,
      originalAmount,
      discountAmount,
      finalAmount,
      freeMonths,
      freeDays,
      purpose: coupon.purpose,
      accountingCategory: coupon.accounting_category,
      affectsRevenue: coupon.affects_revenue,
      activatePlanCode: coupon.activate_plan_code,
      currencyCode: plan.currency_code,
    };
  }

  private assertBillingCycleAllowed(
    plan: PlanRecord,
    billingCycle: SubscriptionBillingCycle,
  ): void {
    if (billingCycle === 'manual') {
      return;
    }
    if (!plan.billing_cycle_options.includes(billingCycle)) {
      throw new BadRequestException(`Plan ${plan.code} does not support ${billingCycle} billing`);
    }
  }

  private resolveSubscriptionPeriod(input: {
    plan: PlanRecord;
    status: SubscriptionStatus;
    billingCycle: SubscriptionBillingCycle;
    startsAt: Date;
    trialDays?: number;
  }): { currentPeriodEnd: Date | null; trialEndsAt: Date | null; nextBillingAt: Date | null } {
    if (input.status === 'trialing') {
      const trialEndsAt = new Date(input.startsAt.getTime() + (input.trialDays ?? 0) * 86_400_000);
      return {
        currentPeriodEnd: trialEndsAt,
        trialEndsAt,
        nextBillingAt: trialEndsAt,
      };
    }

    if (input.status === 'canceled' || input.status === 'expired') {
      return { currentPeriodEnd: null, trialEndsAt: null, nextBillingAt: null };
    }

    const amount = SaasHelpers.computePlanAmount(input.plan, input.billingCycle);
    if (amount <= 0 || input.billingCycle === 'manual') {
      return { currentPeriodEnd: null, trialEndsAt: null, nextBillingAt: null };
    }

    const nextBillingAt = SaasHelpers.computeNextBillingAt(input.startsAt, input.billingCycle);
    return {
      currentPeriodEnd: nextBillingAt,
      trialEndsAt: null,
      nextBillingAt,
    };
  }

  private toSubscriptionSettingsResponse(settings: SubscriptionSettingsRecord) {
    return {
      id: settings.id,
      signupTrialEnabled: settings.signup_trial_enabled,
      signupTrialPlanCode: settings.signup_trial_plan_code,
      signupTrialDays: settings.signup_trial_days,
      afterTrialBehavior: settings.after_trial_behavior,
      freePlanCode: settings.free_plan_code,
      allowTrialPlanChange: settings.allow_trial_plan_change,
      oneTrialPerStore: settings.one_trial_per_store,
      oneTrialPerOwner: settings.one_trial_per_owner,
      trialRequiresPaymentMethod: settings.trial_requires_payment_method,
      trialReminderDaysBefore: settings.trial_reminder_days_before,
      createdAt: settings.created_at,
      updatedAt: settings.updated_at,
    };
  }

  private toCouponResponse(coupon: SubscriptionCouponRecord) {
    return {
      id: coupon.id,
      code: coupon.code,
      name: coupon.name,
      description: coupon.description,
      discountType: coupon.discount_type,
      discountValue: Number(coupon.discount_value),
      currencyCode: coupon.currency_code,
      durationMonths: coupon.duration_months,
      appliesToPlanCodes: coupon.applies_to_plan_codes,
      purpose: coupon.purpose,
      accountingCategory: coupon.accounting_category,
      affectsRevenue: coupon.affects_revenue,
      activatePlanCode: coupon.activate_plan_code,
      maxRedemptions: coupon.max_redemptions,
      maxRedemptionsPerStore: coupon.max_redemptions_per_store,
      redeemedCount: coupon.redeemed_count,
      startsAt: coupon.starts_at,
      expiresAt: coupon.expires_at,
      isActive: coupon.is_active,
      createdAt: coupon.created_at,
      updatedAt: coupon.updated_at,
    };
  }

  private toReceiptResponse(receipt: SubscriptionPaymentReceiptRecord) {
    return {
      id: receipt.id,
      storeId: receipt.store_id,
      storeName: receipt.store_name ?? null,
      storeSlug: receipt.store_slug ?? null,
      subscriptionId: receipt.subscription_id,
      invoiceId: receipt.invoice_id,
      invoiceNumber: receipt.invoice_number ?? null,
      invoiceStatus: receipt.invoice_status ?? null,
      paymentId: receipt.payment_id,
      status: receipt.status,
      paymentMethodId: receipt.payment_method_id,
      paymentMethodCode: receipt.payment_method_code,
      paymentMethodName: receipt.payment_method_name,
      amount: Number(receipt.amount),
      currencyCode: receipt.currency_code,
      transactionReference: receipt.transaction_reference,
      paidAt: receipt.paid_at,
      receiptMediaId: receipt.receipt_media_id,
      receiptUrl: receipt.receipt_url,
      receiptFileName: receipt.receipt_file_name,
      receiptMimeType: receipt.receipt_mime_type,
      receiptSizeBytes: receipt.receipt_size_bytes ? Number(receipt.receipt_size_bytes) : null,
      merchantNote: receipt.merchant_note,
      adminNote: receipt.admin_note,
      rejectionReason: receipt.rejection_reason,
      reviewedByAdminId: receipt.reviewed_by_admin_id,
      reviewedAt: receipt.reviewed_at,
      createdByUserId: receipt.created_by_user_id,
      createdAt: receipt.created_at,
      updatedAt: receipt.updated_at,
      metadata: receipt.metadata,
    };
  }

  private async toPlanResponse(plan: PlanRecord): Promise<PlanResponse> {
    const limits = await this.saasRepository.listPlanLimits(plan.id);
    const entitlements = await this.saasRepository.listPlanEntitlements(plan.id);
    return {
      id: plan.id,
      code: plan.code,
      name: plan.name,
      description: plan.description,
      isActive: plan.is_active,
      monthlyPrice: SaasHelpers.parseAmount(plan.monthly_price),
      annualPrice: SaasHelpers.parseAmount(plan.annual_price),
      monthlyCompareAtPrice: SaasHelpers.parseAmount(plan.monthly_compare_at_price),
      annualCompareAtPrice: SaasHelpers.parseAmount(plan.annual_compare_at_price),
      currencyCode: plan.currency_code,
      billingCycleOptions: plan.billing_cycle_options,
      trialDaysDefault: plan.trial_days_default,
      saleLabel: plan.sale_label,
      saleStartsAt: plan.sale_starts_at,
      saleEndsAt: plan.sale_ends_at,
      isIntroOffer: plan.is_intro_offer,
      isSaleActive: plan.is_sale_active,
      isSaleVisible: SaasHelpers.isPlanSaleVisible(plan),
      limits: limits.map((limit) => ({
        metricKey: limit.metric_key,
        metricLimit: limit.metric_limit,
        resetPeriod: limit.reset_period,
      })),
      entitlements: entitlements.map((entitlement) => ({
        featureKey: entitlement.feature_key,
        isEnabled: entitlement.is_enabled,
      })),
    };
  }
}

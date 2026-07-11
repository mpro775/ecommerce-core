import type { LimitResetPeriod, SaasFeatureKey } from '../constants/saas-metrics.constants';
import {
  LIMIT_RESET_PERIODS,
  SAAS_FEATURES,
  SAAS_METRICS,
} from '../constants/saas-metrics.constants';
import type {
  CurrentSubscriptionRecord,
  PlanLimitRecord,
  PlanEntitlementRecord,
  PlanRecord,
  SubscriptionInvoiceRecord,
} from '../saas.repository';
import type { SubscriptionBillingCycle } from '../constants/subscription-core.constants';
import type { InvoiceResponse, StoreSubscriptionResponse } from './types';

export class SaasHelpers {
  static parseAmount(value: string | null): number | null {
    if (value === null) {
      return null;
    }
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  static computePlanAmount(plan: PlanRecord, billingCycle: SubscriptionBillingCycle): number {
    if (billingCycle === 'annual') {
      return SaasHelpers.parseAmount(plan.annual_price) ?? 0;
    }

    if (billingCycle === 'monthly') {
      return SaasHelpers.parseAmount(plan.monthly_price) ?? 0;
    }

    return 0;
  }

  static isPlanSaleVisible(plan: {
    is_sale_active?: boolean;
    sale_starts_at?: Date | null;
    sale_ends_at?: Date | null;
  }): boolean {
    if (!plan.is_sale_active) {
      return false;
    }
    const now = new Date();
    if (plan.sale_starts_at && plan.sale_starts_at.getTime() > now.getTime()) {
      return false;
    }
    if (plan.sale_ends_at && plan.sale_ends_at.getTime() < now.getTime()) {
      return false;
    }
    return true;
  }

  static computeProrationCredit(
    currentSubscription: CurrentSubscriptionRecord,
    currentPlan: PlanRecord,
    at: Date,
  ): number {
    if (!currentSubscription.current_period_end) {
      return 0;
    }

    const end = currentSubscription.current_period_end.getTime();
    const now = at.getTime();
    if (end <= now) {
      return 0;
    }

    const start = currentSubscription.starts_at.getTime();
    const total = Math.max(1, end - start);
    const remaining = end - now;
    const ratio = Math.max(0, Math.min(1, remaining / total));
    const fullAmount = SaasHelpers.computePlanAmount(
      currentPlan,
      currentSubscription.billing_cycle,
    );
    return Number((fullAmount * ratio).toFixed(2));
  }

  static computeNextBillingAt(startsAt: Date, billingCycle: SubscriptionBillingCycle): Date | null {
    if (billingCycle === 'manual') {
      return null;
    }
    const next = new Date(startsAt.getTime());
    if (billingCycle === 'annual') {
      next.setUTCFullYear(next.getUTCFullYear() + 1);
      return next;
    }
    next.setUTCMonth(next.getUTCMonth() + 1);
    return next;
  }

  static generateInvoiceNumber(): string {
    const part = Math.floor(Math.random() * 1_000_000)
      .toString()
      .padStart(6, '0');
    return `INV-${new Date().getUTCFullYear()}-${part}`;
  }

  static toCsv(headers: string[], rows: unknown[][]): string {
    const escape = (value: unknown) => {
      if (value === null || value === undefined) return '';
      const text = value instanceof Date ? value.toISOString() : String(value);
      return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    return [headers.map(escape).join(','), ...rows.map((row) => row.map(escape).join(','))].join(
      '\r\n',
    );
  }

  static toSubscriptionResponse(
    subscription: CurrentSubscriptionRecord,
    limits: PlanLimitRecord[],
    entitlements: PlanEntitlementRecord[],
    usage: Array<{
      metricKey: string;
      used: number;
      limit: number | null;
      resetPeriod: LimitResetPeriod;
    }>,
  ): StoreSubscriptionResponse {
    return {
      id: subscription.id,
      storeId: subscription.store_id,
      status: subscription.status,
      startsAt: subscription.starts_at,
      currentPeriodEnd: subscription.current_period_end,
      trialEndsAt: subscription.trial_ends_at,
      billingCycle: subscription.billing_cycle,
      nextBillingAt: subscription.next_billing_at,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      canceledAt: subscription.canceled_at,
      plan: {
        id: subscription.plan_id,
        code: subscription.plan_code,
        name: subscription.plan_name,
        description: subscription.plan_description,
        isActive: subscription.plan_is_active,
        monthlyPrice: SaasHelpers.parseAmount(subscription.plan_monthly_price),
        annualPrice: SaasHelpers.parseAmount(subscription.plan_annual_price),
        monthlyCompareAtPrice: SaasHelpers.parseAmount(subscription.plan_monthly_compare_at_price),
        annualCompareAtPrice: SaasHelpers.parseAmount(subscription.plan_annual_compare_at_price),
        currencyCode: subscription.plan_currency_code,
        saleLabel: subscription.plan_sale_label,
        saleStartsAt: subscription.plan_sale_starts_at,
        saleEndsAt: subscription.plan_sale_ends_at,
        isIntroOffer: subscription.plan_is_intro_offer,
        isSaleActive: subscription.plan_is_sale_active,
        isSaleVisible: SaasHelpers.isPlanSaleVisible({
          is_sale_active: subscription.plan_is_sale_active,
          sale_starts_at: subscription.plan_sale_starts_at,
          sale_ends_at: subscription.plan_sale_ends_at,
        }),
      },
      limits: limits.map((limit) => ({
        metricKey: limit.metric_key,
        metricLimit: limit.metric_limit,
        resetPeriod: limit.reset_period,
      })),
      entitlements: entitlements.map((entitlement) => ({
        featureKey: entitlement.feature_key,
        isEnabled: entitlement.is_enabled,
      })),
      usage,
    };
  }

  static toPlatformDomainResponse(domain: {
    id: string;
    store_id: string;
    store_name: string;
    hostname: string;
    status: string;
    ssl_status: string;
    ssl_provider?: string;
    ssl_mode?: string;
    ssl_last_checked_at?: Date | null;
    ssl_error?: string | null;
    cloudflare_zone_id?: string | null;
    cloudflare_hostname_id?: string | null;
    last_dns_check_at?: Date | null;
    last_dns_check_result?: Record<string, unknown>[] | null;
    support_required?: boolean;
    technical_error_code?: string | null;
    technical_error_message?: string | null;
    verification_token?: string;
    verified_at?: Date | null;
    activated_at?: Date | null;
    updated_at: Date;
  }) {
    return {
      id: domain.id,
      storeId: domain.store_id,
      storeName: domain.store_name,
      hostname: domain.hostname,
      status: domain.status,
      sslStatus: domain.ssl_status,
      sslProvider: domain.ssl_provider ?? null,
      sslMode: domain.ssl_mode ?? null,
      sslLastCheckedAt: domain.ssl_last_checked_at ?? null,
      sslError: domain.ssl_error ?? null,
      cloudflareZoneId: domain.cloudflare_zone_id ?? null,
      cloudflareHostnameId: domain.cloudflare_hostname_id ?? null,
      lastDnsCheckAt: domain.last_dns_check_at ?? null,
      lastDnsCheckResult: domain.last_dns_check_result ?? [],
      supportRequired: domain.support_required ?? false,
      technicalErrorCode: domain.technical_error_code ?? null,
      technicalErrorMessage: domain.technical_error_message ?? null,
      verificationToken: domain.verification_token ?? null,
      verifiedAt: domain.verified_at ?? null,
      activatedAt: domain.activated_at ?? null,
      updatedAt: domain.updated_at,
    };
  }

  static toPlatformSupportCaseResponse(row: {
    id: string;
    store_id: string | null;
    subject: string;
    description: string;
    priority: string;
    status: string;
    queue: string;
    assignee_admin_id: string | null;
    assignee_name: string | null;
    sla_due_at: Date | null;
    impact_score: number;
    created_by_admin_id: string | null;
    created_by_name: string | null;
    resolved_at: Date | null;
    created_at: Date;
    updated_at: Date;
  }) {
    return {
      id: row.id,
      storeId: row.store_id,
      subject: row.subject,
      description: row.description,
      priority: row.priority,
      status: row.status,
      queue: row.queue,
      assigneeAdminId: row.assignee_admin_id,
      assigneeName: row.assignee_name,
      slaDueAt: row.sla_due_at,
      impactScore: row.impact_score,
      createdByAdminId: row.created_by_admin_id,
      createdByName: row.created_by_name,
      resolvedAt: row.resolved_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  static toPlatformRiskViolationResponse(row: {
    id: string;
    store_id: string | null;
    category: string;
    severity: string;
    score: number;
    status: string;
    summary: string;
    details: Record<string, unknown>;
    detected_at: Date;
    resolved_at: Date | null;
    owner_admin_id: string | null;
    owner_name: string | null;
    created_at: Date;
    updated_at: Date;
  }) {
    return {
      id: row.id,
      storeId: row.store_id,
      category: row.category,
      severity: row.severity,
      score: row.score,
      status: row.status,
      summary: row.summary,
      details: row.details,
      detectedAt: row.detected_at,
      resolvedAt: row.resolved_at,
      ownerAdminId: row.owner_admin_id,
      ownerName: row.owner_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  static toPlatformComplianceTaskResponse(row: {
    id: string;
    violation_id: string | null;
    policy_key: string;
    title: string;
    status: string;
    due_at: Date | null;
    assignee_admin_id: string | null;
    assignee_name: string | null;
    checklist: Record<string, unknown>[];
    evidence: Record<string, unknown>;
    created_at: Date;
    updated_at: Date;
  }) {
    return {
      id: row.id,
      violationId: row.violation_id,
      policyKey: row.policy_key,
      title: row.title,
      status: row.status,
      dueAt: row.due_at,
      assigneeAdminId: row.assignee_admin_id,
      assigneeName: row.assignee_name,
      checklist: row.checklist,
      evidence: row.evidence,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  static toInvoiceResponse(invoice: SubscriptionInvoiceRecord): InvoiceResponse {
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoice_number,
      billingCycle: invoice.billing_cycle,
      subtotalAmount: Number(invoice.subtotal_amount),
      originalAmount: invoice.original_amount === null ? null : Number(invoice.original_amount),
      discountAmount: Number(invoice.discount_amount),
      couponCode: invoice.coupon_code,
      taxAmount: Number(invoice.tax_amount),
      totalAmount: Number(invoice.total_amount),
      currencyCode: invoice.currency_code,
      status: invoice.status,
      dueAt: invoice.due_at,
      paidAt: invoice.paid_at,
      periodStart: invoice.period_start,
      periodEnd: invoice.period_end,
      createdAt: invoice.created_at,
    };
  }

  static validateLimits(
    limits: Array<{
      metricKey: string;
      metricLimit?: number | null;
      resetPeriod: LimitResetPeriod;
    }>,
  ): void {
    const seen = new Set<string>();

    for (const limit of limits) {
      if (!SAAS_METRICS.includes(limit.metricKey as (typeof SAAS_METRICS)[number])) {
        throw new Error(`Unsupported metric key ${limit.metricKey}`);
      }

      if (!LIMIT_RESET_PERIODS.includes(limit.resetPeriod)) {
        throw new Error(`Unsupported reset period ${limit.resetPeriod}`);
      }

      if (seen.has(limit.metricKey)) {
        throw new Error(`Duplicate limit definition for ${limit.metricKey}`);
      }
      seen.add(limit.metricKey);
    }

    if (seen.size !== SAAS_METRICS.length) {
      throw new Error('Plan limits must define all SaaS metrics. Missing values are not allowed.');
    }
  }

  static validateEntitlements(
    entitlements: Array<{
      featureKey: SaasFeatureKey;
      isEnabled: boolean;
    }>,
  ): void {
    const seen = new Set<string>();
    for (const entitlement of entitlements) {
      if (!SAAS_FEATURES.includes(entitlement.featureKey)) {
        throw new Error(`Unsupported feature key ${entitlement.featureKey}`);
      }
      if (seen.has(entitlement.featureKey)) {
        throw new Error(`Duplicate entitlement definition for ${entitlement.featureKey}`);
      }
      seen.add(entitlement.featureKey);
    }

    if (seen.size !== SAAS_FEATURES.length) {
      throw new Error(
        'Plan entitlements must define all SaaS features. Missing values are not allowed.',
      );
    }
  }
}

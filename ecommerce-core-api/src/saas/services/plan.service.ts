import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import type { RequestContextData } from '../../common/utils/request-context.util';
import type { SaasMetricKey } from '../constants/saas-metrics.constants';
import type { CreatePlanDto } from '../dto/create-plan.dto';
import type { UpdatePlanDto } from '../dto/update-plan.dto';
import { SaasRepository, type PlanRecord } from '../saas.repository';
import { SaasHelpers } from './helpers';
import type { PlanResponse } from './types';

@Injectable()
export class PlanService {
  constructor(
    private readonly saasRepository: SaasRepository,
    private readonly auditService: AuditService,
  ) {}

  async listPlans(): Promise<PlanResponse[]> {
    const plans = await this.saasRepository.listPlans();
    return Promise.all(plans.map((plan) => this.toPlanResponse(plan)));
  }

  async createPlan(input: CreatePlanDto): Promise<PlanResponse> {
    const existing = await this.saasRepository.findPlanByCode(input.code.trim().toLowerCase());
    if (existing) {
      throw new ConflictException('Plan code already exists');
    }

    try {
      SaasHelpers.validateLimits(input.limits);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }

    try {
      SaasHelpers.validateEntitlements(input.entitlements);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    this.validatePlanSaleInput({
      code: input.code.trim().toLowerCase(),
      billingCycleOptions: input.billingCycleOptions ?? ['monthly'],
      monthlyPrice: input.monthlyPrice ?? null,
      annualPrice: input.annualPrice ?? null,
      monthlyCompareAtPrice: input.monthlyCompareAtPrice ?? null,
      annualCompareAtPrice: input.annualCompareAtPrice ?? null,
      currencyCode: input.currencyCode ?? 'YER',
      isSaleActive: input.isSaleActive ?? false,
      saleLabel: input.saleLabel?.trim() || null,
      saleStartsAt: input.saleStartsAt ? new Date(input.saleStartsAt) : null,
      saleEndsAt: input.saleEndsAt ? new Date(input.saleEndsAt) : null,
    });

    const created = await this.saasRepository.withTransaction(async (db) => {
      const plan = await this.saasRepository.createPlan(
        {
          code: input.code.trim().toLowerCase(),
          name: input.name.trim(),
          description: input.description?.trim() ?? null,
          isActive: input.isActive ?? true,
          monthlyPrice: input.monthlyPrice ?? null,
          annualPrice: input.annualPrice ?? null,
          monthlyCompareAtPrice: input.monthlyCompareAtPrice ?? null,
          annualCompareAtPrice: input.annualCompareAtPrice ?? null,
          currencyCode: input.currencyCode ?? 'YER',
          billingCycleOptions: input.billingCycleOptions ?? ['monthly'],
          trialDaysDefault: input.trialDaysDefault ?? 0,
          saleLabel: input.saleLabel?.trim() || null,
          saleStartsAt: input.saleStartsAt ? new Date(input.saleStartsAt) : null,
          saleEndsAt: input.saleEndsAt ? new Date(input.saleEndsAt) : null,
          isIntroOffer: input.isIntroOffer ?? false,
          isSaleActive: input.isSaleActive ?? false,
          metadata: {},
        },
        db,
      );

      await this.saasRepository.replacePlanLimits(
        db,
        plan.id,
        input.limits.map((limit) => ({
          metricKey: limit.metricKey,
          metricLimit: limit.metricLimit ?? null,
          resetPeriod: limit.resetPeriod,
        })),
      );

      await this.saasRepository.replacePlanEntitlements(
        db,
        plan.id,
        input.entitlements.map((entitlement) => ({
          featureKey: entitlement.featureKey,
          isEnabled: entitlement.isEnabled,
        })),
      );

      return plan;
    });

    return this.toPlanResponse(created);
  }

  async updatePlan(planId: string, input: UpdatePlanDto): Promise<PlanResponse> {
    const existing = await this.saasRepository.findPlanById(planId);
    if (!existing) {
      throw new NotFoundException('Plan not found');
    }

    if (input.limits) {
      try {
        SaasHelpers.validateLimits(input.limits);
      } catch (e) {
        throw new BadRequestException((e as Error).message);
      }
    }

    if (input.entitlements) {
      try {
        SaasHelpers.validateEntitlements(input.entitlements);
      } catch (e) {
        throw new BadRequestException((e as Error).message);
      }
    }

    const nextMonthlyPrice = input.monthlyPrice ?? SaasHelpers.parseAmount(existing.monthly_price);
    const nextAnnualPrice = input.annualPrice ?? SaasHelpers.parseAmount(existing.annual_price);
    const nextMonthlyCompareAtPrice =
      input.monthlyCompareAtPrice === undefined
        ? SaasHelpers.parseAmount(existing.monthly_compare_at_price)
        : input.monthlyCompareAtPrice;
    const nextAnnualCompareAtPrice =
      input.annualCompareAtPrice === undefined
        ? SaasHelpers.parseAmount(existing.annual_compare_at_price)
        : input.annualCompareAtPrice;
    const nextSaleStartsAt =
      input.saleStartsAt === undefined
        ? existing.sale_starts_at
        : input.saleStartsAt
          ? new Date(input.saleStartsAt)
          : null;
    const nextSaleEndsAt =
      input.saleEndsAt === undefined
        ? existing.sale_ends_at
        : input.saleEndsAt
          ? new Date(input.saleEndsAt)
          : null;
    this.validatePlanSaleInput({
      code: existing.code,
      billingCycleOptions: input.billingCycleOptions ?? existing.billing_cycle_options,
      monthlyPrice: nextMonthlyPrice,
      annualPrice: nextAnnualPrice,
      monthlyCompareAtPrice: nextMonthlyCompareAtPrice,
      annualCompareAtPrice: nextAnnualCompareAtPrice,
      currencyCode: input.currencyCode ?? existing.currency_code,
      isSaleActive: input.isSaleActive ?? existing.is_sale_active,
      saleLabel:
        input.saleLabel === undefined ? existing.sale_label : input.saleLabel?.trim() || null,
      saleStartsAt: nextSaleStartsAt,
      saleEndsAt: nextSaleEndsAt,
    });

    await this.saasRepository.withTransaction(async (db) => {
      await this.saasRepository.updatePlan(
        {
          planId,
          name: input.name?.trim() ?? existing.name,
          description: input.description?.trim() ?? existing.description,
          isActive: input.isActive ?? existing.is_active,
          monthlyPrice: nextMonthlyPrice,
          annualPrice: nextAnnualPrice,
          monthlyCompareAtPrice: nextMonthlyCompareAtPrice,
          annualCompareAtPrice: nextAnnualCompareAtPrice,
          currencyCode: input.currencyCode ?? existing.currency_code,
          billingCycleOptions: input.billingCycleOptions ?? existing.billing_cycle_options,
          trialDaysDefault: input.trialDaysDefault ?? existing.trial_days_default,
          saleLabel:
            input.saleLabel === undefined ? existing.sale_label : input.saleLabel?.trim() || null,
          saleStartsAt: nextSaleStartsAt,
          saleEndsAt: nextSaleEndsAt,
          isIntroOffer: input.isIntroOffer ?? existing.is_intro_offer,
          isSaleActive: input.isSaleActive ?? existing.is_sale_active,
          metadata: existing.metadata ?? {},
        },
        db,
      );

      if (input.limits) {
        await this.saasRepository.replacePlanLimits(
          db,
          planId,
          input.limits.map((limit) => ({
            metricKey: limit.metricKey,
            metricLimit: limit.metricLimit ?? null,
            resetPeriod: limit.resetPeriod,
          })),
        );
      }

      if (input.entitlements) {
        await this.saasRepository.replacePlanEntitlements(
          db,
          planId,
          input.entitlements.map((entitlement) => ({
            featureKey: entitlement.featureKey,
            isEnabled: entitlement.isEnabled,
          })),
        );
      }
    });

    const fresh = await this.saasRepository.findPlanById(planId);
    if (!fresh) {
      throw new NotFoundException('Plan not found');
    }

    return this.toPlanResponse(fresh);
  }

  async archivePlan(planId: string, context: RequestContextData): Promise<PlanResponse> {
    const existing = await this.saasRepository.findPlanById(planId);
    if (!existing) {
      throw new NotFoundException('Plan not found');
    }

    const archived = await this.saasRepository.setPlanActive(planId, false);
    if (!archived) {
      throw new NotFoundException('Plan not found');
    }

    await this.auditService.log({
      action: 'platform.plan_archived',
      storeId: null,
      storeUserId: null,
      targetType: 'plan',
      targetId: archived.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        requestId: context.requestId,
        code: archived.code,
      },
    });

    return this.toPlanResponse(archived);
  }

  async duplicatePlan(planId: string, context: RequestContextData): Promise<PlanResponse> {
    const existing = await this.saasRepository.findPlanById(planId);
    if (!existing) {
      throw new NotFoundException('Plan not found');
    }

    const limits = await this.saasRepository.listPlanLimits(planId);
    const entitlements = await this.saasRepository.listPlanEntitlements(planId);
    const baseCode = `${existing.code}-copy`;
    let nextCode = baseCode;
    let suffix = 1;
    while (await this.saasRepository.findPlanByCode(nextCode)) {
      suffix += 1;
      nextCode = `${baseCode}-${suffix}`;
    }

    const duplicateInput: CreatePlanDto = {
      code: nextCode,
      name: `${existing.name} Copy`,
      isActive: false,
      monthlyPrice: SaasHelpers.parseAmount(existing.monthly_price),
      annualPrice: SaasHelpers.parseAmount(existing.annual_price),
      monthlyCompareAtPrice: SaasHelpers.parseAmount(existing.monthly_compare_at_price),
      annualCompareAtPrice: SaasHelpers.parseAmount(existing.annual_compare_at_price),
      currencyCode: existing.currency_code,
      billingCycleOptions:
        existing.billing_cycle_options.filter(
          (cycle): cycle is 'monthly' | 'annual' => cycle === 'monthly' || cycle === 'annual',
        ).length > 0
          ? existing.billing_cycle_options.filter(
              (cycle): cycle is 'monthly' | 'annual' => cycle === 'monthly' || cycle === 'annual',
            )
          : ['monthly'],
      trialDaysDefault: existing.trial_days_default,
      saleLabel: existing.sale_label,
      saleStartsAt: existing.sale_starts_at?.toISOString() ?? null,
      saleEndsAt: existing.sale_ends_at?.toISOString() ?? null,
      isIntroOffer: existing.is_intro_offer,
      isSaleActive: existing.is_sale_active,
      limits: limits.map((limit) => ({
        metricKey: limit.metric_key as SaasMetricKey,
        metricLimit: limit.metric_limit,
        resetPeriod: limit.reset_period,
      })),
      entitlements: entitlements.map((entry) => ({
        featureKey: entry.feature_key,
        isEnabled: entry.is_enabled,
      })),
    };

    if (existing.description !== null) {
      duplicateInput.description = existing.description;
    }

    const created = await this.createPlan(duplicateInput);

    await this.auditService.log({
      action: 'platform.plan_duplicated',
      storeId: null,
      storeUserId: null,
      targetType: 'plan',
      targetId: created.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        requestId: context.requestId,
        sourcePlanId: planId,
        sourcePlanCode: existing.code,
        duplicatedPlanCode: created.code,
      },
    });

    return created;
  }

  private validatePlanSaleInput(input: {
    code?: string;
    billingCycleOptions?: string[];
    monthlyPrice: number | null;
    annualPrice: number | null;
    monthlyCompareAtPrice: number | null;
    annualCompareAtPrice: number | null;
    currencyCode?: string;
    isSaleActive?: boolean;
    saleLabel?: string | null;
    saleStartsAt: Date | null;
    saleEndsAt: Date | null;
  }): void {
    const cycles = input.billingCycleOptions ?? [];
    if (cycles.length === 0) {
      throw new BadRequestException('At least one billing cycle is required');
    }
    if (cycles.some((cycle) => cycle !== 'monthly' && cycle !== 'annual')) {
      throw new BadRequestException('Billing cycle options must be monthly or annual');
    }
    if (input.currencyCode && !/^[A-Z]{3}$/.test(input.currencyCode)) {
      throw new BadRequestException('Currency code must be a 3-letter uppercase ISO code');
    }
    if ((input.currencyCode ?? 'YER') !== 'YER') {
      throw new BadRequestException('Subscription plans must use YER');
    }
    const isFreePlan = input.code?.toLowerCase() === 'free';
    if (isFreePlan) {
      if ((input.monthlyPrice ?? 0) !== 0 || (input.annualPrice ?? 0) !== 0) {
        throw new BadRequestException('Free plan prices must be zero');
      }
    } else if (
      cycles.includes('monthly') &&
      input.monthlyPrice === null &&
      cycles.includes('annual') &&
      input.annualPrice === null
    ) {
      throw new BadRequestException(
        'Paid plans require a price for at least one enabled billing cycle',
      );
    }
    if (
      input.monthlyCompareAtPrice !== null &&
      input.monthlyPrice !== null &&
      input.monthlyCompareAtPrice <= input.monthlyPrice
    ) {
      throw new BadRequestException('Monthly compare-at price must be greater than monthly price');
    }
    if (
      input.annualCompareAtPrice !== null &&
      input.annualPrice !== null &&
      input.annualCompareAtPrice <= input.annualPrice
    ) {
      throw new BadRequestException('Annual compare-at price must be greater than annual price');
    }
    if (input.saleStartsAt && input.saleEndsAt && input.saleEndsAt <= input.saleStartsAt) {
      throw new BadRequestException('Sale end date must be after sale start date');
    }
    if (
      input.isSaleActive &&
      !input.saleLabel &&
      input.monthlyCompareAtPrice === null &&
      input.annualCompareAtPrice === null
    ) {
      throw new BadRequestException('Active sale requires a sale label or compare-at price');
    }
  }

  private async toPlanResponse(plan: PlanRecord): Promise<PlanResponse> {
    const planLimits = await this.saasRepository.listPlanLimits(plan.id);
    const planEntitlements = await this.saasRepository.listPlanEntitlements(plan.id);
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
      limits: planLimits.map((limit) => ({
        metricKey: limit.metric_key,
        metricLimit: limit.metric_limit,
        resetPeriod: limit.reset_period,
      })),
      entitlements: planEntitlements.map((entitlement) => ({
        featureKey: entitlement.feature_key,
        isEnabled: entitlement.is_enabled,
      })),
    };
  }
}

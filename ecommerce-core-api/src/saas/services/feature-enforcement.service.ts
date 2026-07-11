import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import {
  FEATURE_DESCRIPTIONS,
  FEATURE_DISPLAY_NAMES,
  FEATURE_ENFORCEMENT_AREAS,
  LIMIT_RESET_PERIODS,
  METRIC_DESCRIPTIONS,
  METRIC_DISPLAY_NAMES,
  METRIC_ENFORCEMENT_AREAS,
  SAAS_FEATURES,
  SAAS_METRICS,
  type SaasFeatureKey,
  type SaasMetricKey,
} from '../constants/saas-metrics.constants';
import type { LimitResetPeriod } from '../constants/saas-metrics.constants';
import { SaasRepository } from '../saas.repository';
import { SubscriptionService } from './subscription.service';
import type { CapabilityCatalogResponse } from './types';

@Injectable()
export class FeatureEnforcementService {
  constructor(
    private readonly saasRepository: SaasRepository,
    private readonly auditService: AuditService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  async assertFeatureEnabled(storeId: string, featureKey: SaasFeatureKey): Promise<void> {
    await this.subscriptionService.assertStoreStatusAllowsFeatureUsage(storeId);
    const subscription =
      await this.subscriptionService.requireCurrentSubscriptionWithDefaults(storeId);
    const entitlements = await this.saasRepository.listPlanEntitlements(subscription.plan_id);
    const entitlement = entitlements.find((entry) => entry.feature_key === featureKey);
    if (!entitlement) {
      throw new UnprocessableEntityException({
        code: 'FEATURE_NOT_CONFIGURED',
        featureKey,
        message: `Feature entitlement is not configured for ${featureKey}.`,
      });
    }

    if (!entitlement.is_enabled) {
      const displayName = FEATURE_DISPLAY_NAMES[featureKey] ?? featureKey;
      throw new UnprocessableEntityException({
        code: 'FEATURE_NOT_INCLUDED',
        featureKey,
        displayName,
        message: `Your current plan does not include ${displayName}. Please upgrade your plan.`,
      });
    }
  }

  async isFeatureEnabled(storeId: string, featureKey: SaasFeatureKey): Promise<boolean> {
    try {
      await this.assertFeatureEnabled(storeId, featureKey);
      return true;
    } catch {
      return false;
    }
  }

  async assertMetricCanGrow(
    storeId: string,
    metricKey: SaasMetricKey,
    increment = 1,
  ): Promise<void> {
    const now = new Date();
    const subscription =
      await this.subscriptionService.requireCurrentSubscriptionWithDefaults(storeId);
    await this.subscriptionService.assertSubscriptionStatusAllowsUsage(
      storeId,
      subscription.status,
      subscription.trial_ends_at,
      now,
    );

    const limits = await this.saasRepository.listPlanLimits(subscription.plan_id);
    const limit = limits.find((entry) => entry.metric_key === metricKey);
    if (!limit) {
      throw new UnprocessableEntityException({
        code: 'PLAN_LIMIT_NOT_CONFIGURED',
        metricKey,
        message: `Plan limit is not configured for ${metricKey}. Contact support.`,
      });
    }

    if (limit.metric_limit === null) {
      return;
    }

    const used = await this.subscriptionService.resolveMetricUsage(
      storeId,
      metricKey,
      limit.reset_period,
      now,
    );
    if (used + increment > limit.metric_limit) {
      const displayName = METRIC_DISPLAY_NAMES[metricKey] ?? metricKey;
      throw new UnprocessableEntityException({
        code: 'PLAN_LIMIT_REACHED',
        metricKey,
        displayName,
        used,
        limit: limit.metric_limit,
        attempted: used + increment,
        message: `Plan limit reached for ${displayName}. Used ${used}/${limit.metric_limit}`,
      });
    }
  }

  getCapabilityCatalog(): CapabilityCatalogResponse {
    return {
      metrics: SAAS_METRICS.map((key) => ({
        key,
        displayName: METRIC_DISPLAY_NAMES[key],
        description: METRIC_DESCRIPTIONS[key],
        resetPeriods: [...LIMIT_RESET_PERIODS],
        enforcedIn: METRIC_ENFORCEMENT_AREAS[key],
      })),
      features: SAAS_FEATURES.map((key) => ({
        key,
        displayName: FEATURE_DISPLAY_NAMES[key],
        description: FEATURE_DESCRIPTIONS[key],
        enforcedIn: FEATURE_ENFORCEMENT_AREAS[key],
      })),
    };
  }

  async recordUsageEvent(
    storeId: string,
    metricKey: SaasMetricKey,
    quantity: number,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.saasRepository.recordUsageEvent({
      storeId,
      metricKey,
      quantity,
      metadata,
    });
  }
}

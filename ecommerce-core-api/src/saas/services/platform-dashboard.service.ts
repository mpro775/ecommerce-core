import { Injectable } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { SaasRepository } from '../saas.repository';

@Injectable()
export class PlatformDashboardService {
  constructor(
    private readonly saasRepository: SaasRepository,
    private readonly auditService: AuditService,
  ) {}

  async getPlatformDashboardSummary() {
    const summary = await this.saasRepository.getPlatformDashboardSummary();
    return {
      totalStores: Number(summary.total_stores),
      activeStores: Number(summary.active_stores),
      suspendedStores: Number(summary.suspended_stores),
      totalSubscriptions: Number(summary.total_subscriptions),
      activeSubscriptions: Number(summary.active_subscriptions),
      trialingSubscriptions: Number(summary.trialing_subscriptions),
      pastDueSubscriptions: Number(summary.past_due_subscriptions),
      canceledSubscriptions: Number(summary.canceled_subscriptions),
      totalDomains: Number(summary.total_domains),
      domainIssues: Number(summary.domain_issues),
    };
  }

  async getPlatformDashboardAlerts() {
    const rows = await this.saasRepository.listPlatformDashboardAlerts(30);
    return rows.map((row) => ({
      type: row.type,
      severity: row.severity,
      referenceId: row.reference_id,
      title: row.title,
      createdAt: row.created_at,
    }));
  }

  async getPlatformDashboardActivity() {
    const rows = await this.saasRepository.listRecentPlatformAuditActivity(40);
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

  async getPlatformDashboardGrowth() {
    return this.saasRepository.getPlatformGrowthSummary();
  }

  async getPlatformAnalyticsMrrChurn() {
    return this.saasRepository.getPlatformMrrChurnSummary();
  }

  async getPlatformAnalyticsCohorts() {
    return this.saasRepository.getPlatformCohorts();
  }

  async getPlatformAnalyticsFunnel() {
    return this.saasRepository.getPlatformFunnelSummary();
  }

  async getPlatformAnalyticsOverview() {
    const [mrrChurn, cohorts, funnel] = await Promise.all([
      this.getPlatformAnalyticsMrrChurn(),
      this.getPlatformAnalyticsCohorts(),
      this.getPlatformAnalyticsFunnel(),
    ]);
    return {
      mrrChurn,
      funnel,
      cohorts,
      generatedAt: new Date(),
    };
  }

  async listPlatformAuditLogs(input: {
    q?: string;
    action?: string;
    storeId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Number.isFinite(input.page) && (input.page ?? 0) > 0 ? (input.page as number) : 1;
    const limit =
      Number.isFinite(input.limit) && (input.limit ?? 0) > 0 && (input.limit ?? 0) <= 100
        ? (input.limit as number)
        : 20;
    const result = await this.saasRepository.listPlatformAuditLogs({
      q: input.q?.trim() || null,
      action: input.action?.trim() || null,
      storeId: input.storeId?.trim() || null,
      limit,
      offset: (page - 1) * limit,
    });

    return {
      items: result.rows.map((row) => ({
        id: row.id,
        action: row.action,
        targetType: row.target_type,
        targetId: row.target_id,
        metadata: row.metadata,
        createdAt: row.created_at,
        storeId: row.store_id,
      })),
      total: result.total,
      page,
      limit,
    };
  }

  async getPlatformHealthSummary() {
    let dbStatus: 'ok' | 'down' = 'ok';
    let redisStatus: 'ok' | 'down' = 'ok';
    try {
      await this.saasRepository.pingPostgres();
    } catch {
      dbStatus = 'down';
    }
    try {
      await this.saasRepository.pingRedis();
    } catch {
      redisStatus = 'down';
    }

    const queues = await this.saasRepository.listPlatformQueueOverview();
    const incidents = await this.saasRepository.listPlatformIncidents(50);
    const openIncidents = incidents.filter((incident) => incident.status !== 'resolved').length;
    const failedJobs = queues.reduce((sum, queue) => sum + queue.failed_jobs, 0);

    return {
      api: { status: 'ok' as const },
      db: { status: dbStatus },
      redis: { status: redisStatus },
      queues: {
        totalBacklog: queues.reduce((sum, queue) => sum + queue.backlog_count, 0),
        failedJobs,
      },
      incidents: {
        open: openIncidents,
        totalRecent: incidents.length,
      },
      status: dbStatus === 'ok' && redisStatus === 'ok' && openIncidents === 0 ? 'ok' : 'degraded',
      checkedAt: new Date(),
    };
  }

  async getPlatformHealthQueues() {
    return this.saasRepository.listPlatformQueueOverview();
  }

  async getPlatformOnboardingPipeline() {
    const rows = await this.saasRepository.listOnboardingPipeline(200);
    return rows.map((row) => {
      const blockers: string[] = [];
      if (row.onboarding_status !== 'completed') {
        blockers.push('setup_incomplete');
      }
      if (!row.has_products) {
        blockers.push('missing_products');
      }
      if (!row.has_domain) {
        blockers.push('missing_domain');
      }
      if (!row.first_order_at) {
        blockers.push('no_first_order');
      }
      return {
        storeId: row.store_id,
        storeName: row.store_name,
        storeSlug: row.store_slug,
        createdAt: row.created_at,
        onboardingStatus: row.onboarding_status ?? 'not_started',
        hasProducts: row.has_products,
        hasDomain: row.has_domain,
        firstOrderAt: row.first_order_at,
        trialEndsAt: row.trial_ends_at,
        subscriptionStatus: row.subscription_status ?? 'none',
        blockers,
      };
    });
  }

  async getPlatformOnboardingStuckStores() {
    const rows = await this.saasRepository.listOnboardingStuckStores(200);
    return rows.map((row) => ({
      storeId: row.store_id,
      storeName: row.store_name,
      storeSlug: row.store_slug,
      createdAt: row.created_at,
      onboardingStatus: row.onboarding_status ?? 'not_started',
      hasProducts: row.has_products,
      hasDomain: row.has_domain,
      firstOrderAt: row.first_order_at,
      trialEndsAt: row.trial_ends_at,
      subscriptionStatus: row.subscription_status ?? 'none',
      daysSinceSignup: row.days_since_signup,
    }));
  }
}

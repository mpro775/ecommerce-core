import { Module } from '@nestjs/common';
import { SecurityModule } from '../security/security.module';
import { BillingController } from './billing.controller';
import { BillingWebhookController } from './billing-webhook.controller';
import { FeatureGuard, LimitsGuard } from './guards/limits.guard';
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
import { SaasRepository } from './saas.repository';
import { SaasService } from './saas.service';
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

@Module({
  imports: [SecurityModule],
  controllers: [BillingController, BillingWebhookController],
  providers: [
    PlanRepository,
    SubscriptionRepository,
    InvoiceRepository,
    BillingEventRepository,
    UsageMetricsRepository,
    PlatformStoreRepository,
    PlatformAdminRepository,
    PlatformDashboardRepository,
    PlatformDomainRepository,
    PlatformOperationsRepository,
    SubscriptionCommercialRepository,
    SubscriptionAdjustmentRepository,
    SubscriptionReceiptRepository,
    SaasRepository,
    SubscriptionService,
    FeatureEnforcementService,
    PlanService,
    BillingService,
    PlatformStoreService,
    PlatformAdminService,
    PlatformDashboardService,
    PlatformDomainService,
    PlatformOperationsService,
    ExportService,
    SubscriptionAdjustmentService,
    SaasService,
    LimitsGuard,
    FeatureGuard,
  ],
  exports: [SaasService, SaasRepository, LimitsGuard, FeatureGuard],
})
export class SaasModule {}

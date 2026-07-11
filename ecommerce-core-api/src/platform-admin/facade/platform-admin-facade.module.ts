import { Module } from '@nestjs/common';
import { SaasModule } from '../../saas/saas.module';
import { PlatformAnalyticsService } from '../core/services/platform-analytics.service';
import { PlatformAuditService } from '../core/services/platform-audit.service';
import { PlatformDashboardService } from '../core/services/platform-dashboard.service';
import { PlatformDomainsService } from '../core/services/platform-domains.service';
import { PlatformHealthService } from '../core/services/platform-health.service';
import { PlatformNotesService } from '../core/services/platform-notes.service';
import { PlatformOnboardingService } from '../core/services/platform-onboarding.service';
import { PlatformStoresService } from '../core/services/platform-stores.service';
import { PlatformAdminsService } from '../operations/services/platform-admins.service';
import { PlatformAutomationService } from '../operations/services/platform-automation.service';
import { PlatformComplianceService } from '../operations/services/platform-compliance.service';
import { PlatformRiskService } from '../operations/services/platform-risk.service';
import { PlatformRolesService } from '../operations/services/platform-roles.service';
import { PlatformSettingsService } from '../operations/services/platform-settings.service';
import { PlatformSupportService } from '../operations/services/platform-support.service';
import { PlatformFinanceService } from '../billing/services/platform-finance.service';
import { PlatformInvoicesService } from '../billing/services/platform-invoices.service';
import { PlatformPlansService } from '../billing/services/platform-plans.service';
import { PlatformSubscriptionsService } from '../billing/services/platform-subscriptions.service';
import { PlatformAdminFacade } from './platform-admin.facade';

@Module({
  imports: [SaasModule],
  providers: [
    PlatformDashboardService,
    PlatformStoresService,
    PlatformDomainsService,
    PlatformHealthService,
    PlatformAnalyticsService,
    PlatformAuditService,
    PlatformOnboardingService,
    PlatformNotesService,
    PlatformAdminsService,
    PlatformRolesService,
    PlatformSettingsService,
    PlatformAutomationService,
    PlatformSupportService,
    PlatformRiskService,
    PlatformComplianceService,
    PlatformPlansService,
    PlatformSubscriptionsService,
    PlatformFinanceService,
    PlatformInvoicesService,
    PlatformAdminFacade,
  ],
  exports: [PlatformAdminFacade],
})
export class PlatformAdminFacadeModule {}

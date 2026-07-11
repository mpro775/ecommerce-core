import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { getRequestContext } from '../../common/utils/request-context.util';
import { PLATFORM_PERMISSIONS } from '../../platform/constants/platform-permissions.constants';
import { CurrentPlatformUser } from '../../platform/decorators/current-platform-user.decorator';
import { RequirePlatformPermissions } from '../../platform/decorators/require-platform-permissions.decorator';
import { RequirePlatformStepUp } from '../../platform/decorators/require-platform-step-up.decorator';
import { PlatformAccessTokenGuard } from '../../platform/guards/platform-access-token.guard';
import { PlatformPermissionsGuard } from '../../platform/guards/platform-permissions.guard';
import { PlatformStepUpGuard } from '../../platform/guards/platform-step-up.guard';
import type { PlatformAdminUser } from '../../platform/interfaces/platform-admin-user.interface';
import { ConfirmStoreDeletionDto } from '../../saas/dto/confirm-store-deletion.dto';
import { CreatePlatformIncidentDto } from '../../saas/dto/create-platform-incident.dto';
import { CreateStoreNoteDto } from '../../saas/dto/create-store-note.dto';
import { ListPlatformStoresQueryDto } from '../../saas/dto/list-platform-stores-query.dto';
import { RetryStorePurgeDto } from '../../saas/dto/retry-store-purge.dto';
import { UpdatePlatformIncidentStatusDto } from '../../saas/dto/update-platform-incident-status.dto';
import { UpdateStoreSuspensionDto } from '../../saas/dto/update-store-suspension.dto';
import { SaasService } from '../../saas/saas.service';

@ApiTags('platform-admin')
@ApiBearerAuth()
@Controller('platform')
@UseGuards(PlatformAccessTokenGuard, PlatformPermissionsGuard, PlatformStepUpGuard)
export class PlatformCoreController {
  constructor(private readonly saasService: SaasService) {}

  @Get('dashboard/summary')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.dashboardRead)
  @ApiOkResponse({ description: 'Platform dashboard summary KPIs' })
  async getDashboardSummary() {
    return this.saasService.getPlatformDashboardSummary();
  }

  @Get('dashboard/alerts')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.dashboardRead)
  @ApiOkResponse({ description: 'Platform dashboard alerts feed' })
  async getDashboardAlerts() {
    return this.saasService.getPlatformDashboardAlerts();
  }

  @Get('dashboard/activity')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.dashboardRead)
  @ApiOkResponse({ description: 'Platform dashboard recent activity' })
  async getDashboardActivity() {
    return this.saasService.getPlatformDashboardActivity();
  }

  @Get('dashboard/growth')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.dashboardRead)
  @ApiOkResponse({ description: 'Platform dashboard growth snapshots' })
  async getDashboardGrowth() {
    return this.saasService.getPlatformDashboardGrowth();
  }

  @Get('stores')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.storesRead)
  @ApiOkResponse({ description: 'List stores and platform statuses' })
  async listStores(@Query() query: ListPlatformStoresQueryDto) {
    return this.saasService.listPlatformStores(query);
  }

  @Get('stores/export.csv')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.storesRead)
  @ApiOkResponse({ description: 'Export stores as CSV' })
  async exportStoresCsv(@Query() query: ListPlatformStoresQueryDto) {
    return this.saasService.exportPlatformStoresCsv(query);
  }

  @Get('stores/:storeId')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.storesRead)
  @ApiOkResponse({ description: 'Get store details for platform admin' })
  async getStoreById(@Param('storeId', ParseUUIDPipe) storeId: string) {
    return this.saasService.getPlatformStoreById(storeId);
  }

  @Get('stores/:storeId/usage')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.storesRead)
  @ApiOkResponse({ description: 'Get store usage snapshot based on current plan limits' })
  async getStoreUsage(@Param('storeId', ParseUUIDPipe) storeId: string) {
    return this.saasService.getPlatformStoreUsage(storeId);
  }

  @Get('stores/:storeId/activity')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.storesRead)
  @ApiOkResponse({ description: 'Get latest store activity log feed' })
  async getStoreActivity(@Param('storeId', ParseUUIDPipe) storeId: string) {
    return this.saasService.getPlatformStoreActivity(storeId);
  }

  @Get('stores/:storeId/domains')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.domainsRead)
  @ApiOkResponse({ description: 'Get store domains from platform perspective' })
  async getStoreDomains(@Param('storeId', ParseUUIDPipe) storeId: string) {
    return this.saasService.getPlatformStoreDomains(storeId);
  }

  @Get('stores/:storeId/subscription')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.subscriptionsRead)
  @ApiOkResponse({ description: 'Get store current subscription details' })
  async getStoreSubscription(@Param('storeId', ParseUUIDPipe) storeId: string) {
    return this.saasService.getPlatformStoreSubscription(storeId);
  }

  @Get('stores/:storeId/store-360')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.storesRead)
  @ApiOkResponse({ description: 'Get full store 360 operational view (multi-tab payload)' })
  async getStore360(@Param('storeId', ParseUUIDPipe) storeId: string) {
    return this.saasService.getPlatformStore360(storeId);
  }

  @Get('stores/:storeId/360')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.storesRead)
  @ApiOkResponse({ description: 'Get full store 360 operational view' })
  async getStore360Alias(@Param('storeId', ParseUUIDPipe) storeId: string) {
    return this.saasService.getPlatformStore360(storeId);
  }

  @Patch('stores/:storeId/suspension')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.storesSuspend)
  @RequirePlatformStepUp()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Update store suspension status' })
  async updateStoreSuspension(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() body: UpdateStoreSuspensionDto,
    @Req() request: Request,
  ): Promise<void> {
    await this.saasService.updateStoreSuspension(storeId, body, getRequestContext(request));
  }

  @Post('stores/:storeId/deletion/preview')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.storesDeletePreview)
  @RequirePlatformStepUp()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Preview permanent operational store deletion impact' })
  async previewStoreDeletion(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
    @Req() request: Request,
  ) {
    return this.saasService.previewStoreDeletion(storeId, currentUser, getRequestContext(request));
  }

  @Post('stores/:storeId/deletion/confirm')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.storesDeleteConfirm)
  @RequirePlatformStepUp()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Confirm permanent operational store deletion' })
  async confirmStoreDeletion(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() body: ConfirmStoreDeletionDto,
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
    @Req() request: Request,
  ) {
    return this.saasService.confirmStoreDeletion(
      storeId,
      body,
      currentUser,
      getRequestContext(request),
    );
  }

  @Get('stores/:storeId/deletion/status')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.storesDeleteStatus)
  @ApiOkResponse({ description: 'Read permanent store deletion and purge status' })
  async getStoreDeletionStatus(@Param('storeId', ParseUUIDPipe) storeId: string) {
    return this.saasService.getStoreDeletionStatus(storeId);
  }

  @Post('stores/:storeId/deletion/retry-purge')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.storesPurgeRetry)
  @RequirePlatformStepUp()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Retry failed store operational data purge' })
  async retryStorePurge(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() body: RetryStorePurgeDto,
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
    @Req() request: Request,
  ) {
    return this.saasService.retryStorePurge(storeId, body, currentUser, getRequestContext(request));
  }

  @Get('domains')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.domainsRead)
  @ApiOkResponse({ description: 'List domain statuses across stores' })
  async listDomains() {
    return this.saasService.listPlatformDomains();
  }

  @Get('domains/export.csv')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.domainsRead)
  @ApiOkResponse({ description: 'Export domains as CSV' })
  async exportDomainsCsv() {
    return this.saasService.exportPlatformDomainsCsv();
  }

  @Get('domains/issues')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.domainsRead)
  @ApiOkResponse({ description: 'List domains with operational issues' })
  async listDomainIssues() {
    return this.saasService.listPlatformDomainIssues();
  }

  @Get('domains/:domainId')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.domainsRead)
  @ApiOkResponse({ description: 'Get domain details for platform operations' })
  async getDomainById(@Param('domainId', ParseUUIDPipe) domainId: string) {
    return this.saasService.getPlatformDomainById(domainId);
  }

  @Post('domains/:domainId/recheck')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.domainsWrite)
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Recheck domain SSL/DNS state' })
  async recheckDomain(@Param('domainId', ParseUUIDPipe) domainId: string, @Req() request: Request) {
    return this.saasService.recheckPlatformDomain(domainId, getRequestContext(request));
  }

  @Post('domains/:domainId/force-sync')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.domainsWrite)
  @RequirePlatformStepUp()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Force sync domain state and mark operational refresh' })
  async forceSyncDomain(
    @Param('domainId', ParseUUIDPipe) domainId: string,
    @Req() request: Request,
  ) {
    return this.saasService.forceSyncPlatformDomain(domainId, getRequestContext(request));
  }

  @Get('audit/logs')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.auditRead)
  @ApiOkResponse({ description: 'List platform audit logs with optional filters' })
  async listAuditLogs(
    @Query('q') q?: string,
    @Query('action') action?: string,
    @Query('storeId') storeId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const input: { q?: string; action?: string; storeId?: string; page?: number; limit?: number } =
      {};
    if (q !== undefined) input.q = q;
    if (action !== undefined) input.action = action;
    if (storeId !== undefined) input.storeId = storeId;
    if (page !== undefined) input.page = Number(page);
    if (limit !== undefined) input.limit = Number(limit);
    return this.saasService.listPlatformAuditLogs(input);
  }

  @Get('health/summary')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.healthRead)
  @ApiOkResponse({ description: 'Platform health summary' })
  async getHealthSummary() {
    return this.saasService.getPlatformHealthSummary();
  }

  @Get('health/queues')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.healthRead)
  @ApiOkResponse({ description: 'Platform queue backlog and failed jobs overview' })
  async getHealthQueues() {
    return this.saasService.getPlatformHealthQueues();
  }

  @Get('health/incidents')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.healthRead)
  @ApiOkResponse({ description: 'Platform incidents list' })
  async listIncidents() {
    return this.saasService.listPlatformIncidents();
  }

  @Post('health/incidents')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.healthWrite)
  @RequirePlatformStepUp()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ description: 'Create platform incident' })
  async createIncident(
    @Body() body: CreatePlatformIncidentDto,
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
    @Req() request: Request,
  ) {
    return this.saasService.createPlatformIncident(body, currentUser, getRequestContext(request));
  }

  @Patch('health/incidents/:incidentId/status')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.healthWrite)
  @RequirePlatformStepUp()
  @ApiOkResponse({ description: 'Update platform incident status' })
  async updateIncidentStatus(
    @Param('incidentId', ParseUUIDPipe) incidentId: string,
    @Body() body: UpdatePlatformIncidentStatusDto,
    @Req() request: Request,
  ) {
    return this.saasService.updatePlatformIncidentStatus(
      incidentId,
      body,
      getRequestContext(request),
    );
  }

  @Get('onboarding/pipeline')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.onboardingRead)
  @ApiOkResponse({ description: 'Onboarding pipeline for platform operations' })
  async getOnboardingPipeline() {
    return this.saasService.getPlatformOnboardingPipeline();
  }

  @Get('onboarding/stuck-stores')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.onboardingRead)
  @ApiOkResponse({ description: 'Stuck stores requiring success intervention' })
  async getOnboardingStuckStores() {
    return this.saasService.getPlatformOnboardingStuckStores();
  }

  @Get('stores/:storeId/notes')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.notesRead)
  @ApiOkResponse({ description: 'List internal platform notes for a store' })
  async listStoreNotes(@Param('storeId', ParseUUIDPipe) storeId: string) {
    return this.saasService.listPlatformStoreNotes(storeId);
  }

  @Post('stores/:storeId/notes')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.notesWrite)
  @RequirePlatformStepUp()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ description: 'Create internal platform note for a store' })
  async createStoreNote(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() body: CreateStoreNoteDto,
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
    @Req() request: Request,
  ) {
    return this.saasService.createPlatformStoreNote(
      storeId,
      body,
      currentUser,
      getRequestContext(request),
    );
  }

  @Get('analytics/overview')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.analyticsRead)
  @ApiOkResponse({ description: 'Platform analytics overview (MRR/Churn/Cohorts/Funnel)' })
  async getAnalyticsOverview() {
    return this.saasService.getPlatformAnalyticsOverview();
  }

  @Get('analytics/mrr-churn')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.analyticsRead)
  @ApiOkResponse({ description: 'Platform MRR and churn analytics' })
  async getAnalyticsMrrChurn() {
    return this.saasService.getPlatformAnalyticsMrrChurn();
  }

  @Get('analytics/cohorts')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.analyticsRead)
  @ApiOkResponse({ description: 'Platform cohort analytics' })
  async getAnalyticsCohorts() {
    return this.saasService.getPlatformAnalyticsCohorts();
  }

  @Get('analytics/funnel')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.analyticsRead)
  @ApiOkResponse({ description: 'Platform funnel analytics' })
  async getAnalyticsFunnel() {
    return this.saasService.getPlatformAnalyticsFunnel();
  }
}

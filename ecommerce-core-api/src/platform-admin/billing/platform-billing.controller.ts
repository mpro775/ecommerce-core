import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { getRequestContext } from '../../common/utils/request-context.util';
import { PLATFORM_PERMISSIONS } from '../../platform/constants/platform-permissions.constants';
import { CurrentPlatformUser } from '../../platform/decorators/current-platform-user.decorator';
import { RequirePlatformPermissions } from '../../platform/decorators/require-platform-permissions.decorator';
import { RequirePlatformStepUp } from '../../platform/decorators/require-platform-step-up.decorator';
import { PlatformAccessTokenGuard } from '../../platform/guards/platform-access-token.guard';
import { PlatformPermissionsGuard } from '../../platform/guards/platform-permissions.guard';
import { PlatformStepUpGuard } from '../../platform/guards/platform-step-up.guard';
import { AssignStorePlanDto } from '../../saas/dto/assign-store-plan.dto';
import { AdjustSubscriptionDto } from '../../saas/dto/adjust-subscription.dto';
import { CreatePlanDto } from '../../saas/dto/create-plan.dto';
import { ListPlatformSubscriptionsQueryDto } from '../../saas/dto/list-platform-subscriptions-query.dto';
import { ListSubscriptionReceiptsQueryDto } from '../../saas/dto/list-subscription-receipts-query.dto';
import { ListSubscriptionAdjustmentsQueryDto } from '../../saas/dto/list-subscription-adjustments-query.dto';
import { PlatformInvoiceNoteDto } from '../../saas/dto/platform-invoice-note.dto';
import { ReviewSubscriptionReceiptDto } from '../../saas/dto/review-subscription-receipt.dto';
import { SettleInvoiceDto } from '../../saas/dto/settle-invoice.dto';
import { UpsertSubscriptionCouponDto } from '../../saas/dto/subscription-coupon.dto';
import { UpdatePlanDto } from '../../saas/dto/update-plan.dto';
import { UpdateSubscriptionSettingsDto } from '../../saas/dto/update-subscription-settings.dto';
import { VoidInvoiceDto } from '../../saas/dto/void-invoice.dto';
import { PlanResponse, SaasService, StoreSubscriptionResponse } from '../../saas/saas.service';
import type { PlatformAdminUser } from '../../platform/interfaces/platform-admin-user.interface';

@ApiTags('platform-admin')
@ApiBearerAuth()
@Controller('platform')
@UseGuards(PlatformAccessTokenGuard, PlatformPermissionsGuard, PlatformStepUpGuard)
export class PlatformBillingController {
  constructor(private readonly saasService: SaasService) {}

  @Get('plans')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.plansRead)
  @ApiOkResponse({ description: 'List all SaaS plans with limits' })
  async listPlans(): Promise<PlanResponse[]> {
    return this.saasService.listPlans();
  }

  @Get('capabilities')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.plansRead)
  @ApiOkResponse({ description: 'List supported SaaS metrics and feature entitlements' })
  async getCapabilityCatalog() {
    return this.saasService.getCapabilityCatalog();
  }

  @Get('subscription-settings')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.subscriptionsRead)
  @ApiOkResponse({ description: 'Get subscription trial and commercial settings' })
  async getSubscriptionSettings() {
    return this.saasService.getSubscriptionSettings();
  }

  @Put('subscription-settings')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.subscriptionsWrite)
  @RequirePlatformStepUp()
  @ApiOkResponse({ description: 'Update subscription trial and commercial settings' })
  async updateSubscriptionSettings(@Body() body: UpdateSubscriptionSettingsDto) {
    return this.saasService.updateSubscriptionSettings(body);
  }

  @Post('subscription-trials/process-expired')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.subscriptionsWrite)
  @RequirePlatformStepUp()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Process expired trial subscriptions' })
  async processExpiredTrials(@Query('limit') limit?: string) {
    const parsed = limit ? Number(limit) : 100;
    return this.saasService.processExpiredTrials(Number.isFinite(parsed) ? parsed : 100);
  }

  @Get('subscription-coupons')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.subscriptionsRead)
  @ApiOkResponse({ description: 'List subscription coupons' })
  async listSubscriptionCoupons() {
    return this.saasService.listSubscriptionCoupons();
  }

  @Post('subscription-coupons')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.subscriptionsWrite)
  @RequirePlatformStepUp()
  @ApiCreatedResponse({ description: 'Create subscription coupon' })
  async createSubscriptionCoupon(@Body() body: UpsertSubscriptionCouponDto) {
    return this.saasService.createSubscriptionCoupon(body);
  }

  @Get('subscription-coupons/:couponId')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.subscriptionsRead)
  @ApiOkResponse({ description: 'Get subscription coupon' })
  async getSubscriptionCoupon(@Param('couponId', ParseUUIDPipe) couponId: string) {
    return this.saasService.getSubscriptionCoupon(couponId);
  }

  @Put('subscription-coupons/:couponId')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.subscriptionsWrite)
  @RequirePlatformStepUp()
  @ApiOkResponse({ description: 'Update subscription coupon' })
  async updateSubscriptionCoupon(
    @Param('couponId', ParseUUIDPipe) couponId: string,
    @Body() body: UpsertSubscriptionCouponDto,
  ) {
    return this.saasService.updateSubscriptionCoupon(couponId, body);
  }

  @Delete('subscription-coupons/:couponId')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.subscriptionsWrite)
  @RequirePlatformStepUp()
  @ApiOkResponse({ description: 'Disable subscription coupon' })
  async disableSubscriptionCoupon(@Param('couponId', ParseUUIDPipe) couponId: string) {
    return this.saasService.disableSubscriptionCoupon(couponId);
  }

  @Get('subscription-coupons/:couponId/redemptions')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.subscriptionsRead)
  @ApiOkResponse({ description: 'List subscription coupon redemptions' })
  async listSubscriptionCouponRedemptions(@Param('couponId', ParseUUIDPipe) couponId: string) {
    return this.saasService.listSubscriptionCouponRedemptions(couponId);
  }

  @Get('subscription-receipts')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.subscriptionsRead)
  @ApiOkResponse({ description: 'List subscription payment receipts' })
  async listSubscriptionReceipts(@Query() query: ListSubscriptionReceiptsQueryDto) {
    return this.saasService.listPlatformSubscriptionReceipts(query);
  }

  @Post('subscription-receipts/:receiptId/review')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.subscriptionsWrite)
  @RequirePlatformStepUp()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Approve or reject a subscription payment receipt' })
  async reviewSubscriptionReceipt(
    @Param('receiptId', ParseUUIDPipe) receiptId: string,
    @Body() body: ReviewSubscriptionReceiptDto,
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
    @Req() request: Request,
  ) {
    return this.saasService.reviewSubscriptionReceipt(
      receiptId,
      body,
      currentUser,
      getRequestContext(request),
    );
  }

  @Get('subscription-analytics')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.analyticsRead)
  @ApiOkResponse({ description: 'Get subscription commercial analytics' })
  async getSubscriptionAnalytics() {
    return this.saasService.getSubscriptionAnalytics();
  }

  @Get('billing/subscriptions/overview')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.subscriptionsRead)
  @ApiOkResponse({ description: 'Get platform subscription billing overview' })
  async getBillingSubscriptionsOverview() {
    return this.saasService.getBillingSubscriptionsOverview();
  }

  @Get('billing/reports/summary')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.financeRead)
  @ApiOkResponse({ description: 'Get subscription finance report summary' })
  async getBillingReportSummary(
    @Query()
    query: {
      from?: string;
      to?: string;
      groupBy?: 'day' | 'week' | 'month';
      currency?: string;
    },
  ) {
    return this.saasService.getBillingReportSummary(query);
  }

  @Post('plans')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.plansWrite)
  @RequirePlatformStepUp()
  @ApiCreatedResponse({ description: 'Create new SaaS plan with limits' })
  async createPlan(@Body() body: CreatePlanDto): Promise<PlanResponse> {
    return this.saasService.createPlan(body);
  }

  @Put('plans/:planId')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.plansWrite)
  @RequirePlatformStepUp()
  @ApiOkResponse({ description: 'Update existing plan and optional limits' })
  async updatePlan(
    @Param('planId', ParseUUIDPipe) planId: string,
    @Body() body: UpdatePlanDto,
  ): Promise<PlanResponse> {
    return this.saasService.updatePlan(planId, body);
  }

  @Post('plans/:planId/archive')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.plansWrite)
  @RequirePlatformStepUp()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Archive a plan by marking it inactive' })
  async archivePlan(
    @Param('planId', ParseUUIDPipe) planId: string,
    @Req() request: Request,
  ): Promise<PlanResponse> {
    return this.saasService.archivePlan(planId, getRequestContext(request));
  }

  @Post('plans/:planId/duplicate')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.plansWrite)
  @RequirePlatformStepUp()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ description: 'Duplicate a plan with limits and entitlements' })
  async duplicatePlan(
    @Param('planId', ParseUUIDPipe) planId: string,
    @Req() request: Request,
  ): Promise<PlanResponse> {
    return this.saasService.duplicatePlan(planId, getRequestContext(request));
  }

  @Post('stores/:storeId/subscription')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.subscriptionsWrite)
  @RequirePlatformStepUp()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Assign current subscription plan to store' })
  async assignStorePlan(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() body: AssignStorePlanDto,
    @Req() request: Request,
  ): Promise<StoreSubscriptionResponse> {
    return this.saasService.assignStorePlan(storeId, body, getRequestContext(request));
  }

  @Post('stores/:storeId/subscription/adjust')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.subscriptionsWrite)
  @RequirePlatformStepUp()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Apply an audited subscription ledger adjustment' })
  async adjustStoreSubscription(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() body: AdjustSubscriptionDto,
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
    @Req() request: Request,
  ) {
    return this.saasService.adjustStoreSubscription(
      storeId,
      body,
      currentUser,
      getRequestContext(request),
    );
  }

  @Get('stores/:storeId/subscription/adjustments')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.subscriptionsRead)
  @ApiOkResponse({ description: 'List subscription ledger adjustments for a store' })
  async listStoreSubscriptionAdjustments(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Query() query: ListSubscriptionAdjustmentsQueryDto,
  ) {
    return this.saasService.listStoreSubscriptionAdjustments(storeId, query);
  }

  @Get('stores/:storeId/billing-profile')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.subscriptionsRead)
  @ApiOkResponse({ description: 'Get complete store billing profile' })
  async getStoreBillingProfile(@Param('storeId', ParseUUIDPipe) storeId: string) {
    return this.saasService.getPlatformStoreBillingProfile(storeId);
  }

  @Get('subscriptions/:subscriptionId/adjustments')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.subscriptionsRead)
  @ApiOkResponse({ description: 'List ledger adjustments for a subscription' })
  async listSubscriptionAdjustments(
    @Param('subscriptionId', ParseUUIDPipe) subscriptionId: string,
    @Query() query: ListSubscriptionAdjustmentsQueryDto,
  ) {
    return this.saasService.listSubscriptionAdjustments(subscriptionId, query);
  }

  @Get('subscriptions')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.subscriptionsRead)
  @ApiOkResponse({ description: 'List current subscriptions across stores' })
  async listSubscriptions(@Query() query: ListPlatformSubscriptionsQueryDto) {
    return this.saasService.listPlatformSubscriptions(query);
  }

  @Get('subscriptions/export.csv')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.subscriptionsRead)
  @ApiOkResponse({ description: 'Export subscriptions as CSV' })
  async exportSubscriptionsCsv(@Query() query: ListPlatformSubscriptionsQueryDto) {
    return this.saasService.exportPlatformSubscriptionsCsv(query);
  }

  @Post('stores/:storeId/subscription/cancel')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.subscriptionsWrite)
  @RequirePlatformStepUp()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Cancel store subscription' })
  async cancelSubscription(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
    @Req() request: Request,
  ) {
    const result = await this.saasService.adjustStoreSubscription(
      storeId,
      {
        operation: 'cancel',
        accountingCategory: 'manual_adjustment',
        affectsRevenue: false,
        reason: 'Platform admin canceled subscription',
      },
      currentUser,
      getRequestContext(request),
    );
    return result.subscription;
  }

  @Post('stores/:storeId/subscription/suspend')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.subscriptionsWrite)
  @RequirePlatformStepUp()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Suspend store subscription' })
  async suspendSubscription(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() body: { reason?: string },
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
    @Req() request: Request,
  ) {
    const result = await this.saasService.adjustStoreSubscription(
      storeId,
      {
        operation: 'suspend',
        accountingCategory: 'manual_adjustment',
        affectsRevenue: false,
        reason: body.reason?.trim() || 'Platform admin suspended subscription',
      },
      currentUser,
      getRequestContext(request),
    );
    return result.subscription;
  }

  @Post('stores/:storeId/subscription/resume')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.subscriptionsWrite)
  @RequirePlatformStepUp()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Resume suspended or canceled subscription' })
  async resumeSubscription(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
    @Req() request: Request,
  ) {
    const result = await this.saasService.adjustStoreSubscription(
      storeId,
      {
        operation: 'resume',
        accountingCategory: 'manual_adjustment',
        affectsRevenue: false,
        reason: 'Platform admin resumed subscription',
      },
      currentUser,
      getRequestContext(request),
    );
    return result.subscription;
  }

  @Get('stores/:storeId/subscription/can-downgrade/:planCode')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.subscriptionsRead)
  @ApiOkResponse({ description: 'Check if store can downgrade to a plan' })
  async canDowngradePlan(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('planCode') planCode: string,
  ) {
    return this.saasService.canDowngradePlan(storeId, planCode);
  }

  @Post('invoices/:invoiceId/settle')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.subscriptionsWrite)
  @RequirePlatformStepUp()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Settle an invoice manually (succeeded/failed)' })
  async settleInvoice(
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @Body() body: SettleInvoiceDto,
    @Req() request: Request,
  ) {
    return this.saasService.settleInvoice(invoiceId, body, getRequestContext(request));
  }

  @Get('finance/invoices/export.csv')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.financeRead)
  @ApiOkResponse({ description: 'Export invoices as CSV' })
  async exportInvoicesCsv() {
    return this.saasService.exportPlatformInvoicesCsv();
  }

  @Get('finance/invoices/:invoiceId')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.financeRead)
  @ApiOkResponse({ description: 'Get invoice details' })
  async getInvoice(@Param('invoiceId', ParseUUIDPipe) invoiceId: string) {
    return this.saasService.getPlatformInvoiceById(invoiceId);
  }

  @Post('finance/invoices/:invoiceId/notes')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.financeWrite)
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ description: 'Add invoice internal note' })
  async addInvoiceNote(
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @Body() body: PlatformInvoiceNoteDto,
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
    @Req() request: Request,
  ) {
    return this.saasService.addPlatformInvoiceNote(
      invoiceId,
      body,
      currentUser,
      getRequestContext(request),
    );
  }

  @Post('finance/invoices/:invoiceId/void')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.financeWrite)
  @RequirePlatformStepUp()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Void an invoice with a reason' })
  async voidInvoice(
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @Body() body: VoidInvoiceDto,
    @Req() request: Request,
  ) {
    return this.saasService.voidPlatformInvoice(invoiceId, body, getRequestContext(request));
  }

  @Get('finance/overview')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.financeRead)
  @ApiOkResponse({ description: 'Finance operations overview' })
  async getFinanceOverview() {
    return this.saasService.getPlatformFinanceOverview();
  }

  @Get('finance/aging')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.financeRead)
  @ApiOkResponse({ description: 'Finance aging buckets' })
  async getFinanceAging() {
    return this.saasService.listPlatformFinanceAging();
  }

  @Get('finance/collections')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.financeRead)
  @ApiOkResponse({ description: 'Finance collections worklist' })
  async listFinanceCollections(@Query('limit') limit?: string) {
    const parsed = limit ? Number(limit) : 100;
    return this.saasService.listPlatformFinanceCollections(Number.isFinite(parsed) ? parsed : 100);
  }

  @Get('billing/events')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.auditRead)
  @ApiOkResponse({ description: 'List recent billing lifecycle events' })
  async listBillingEvents(@Query('limit') limit?: string) {
    const parsed = limit ? Number(limit) : 50;
    return this.saasService.listPlatformBillingEvents(Number.isFinite(parsed) ? parsed : 50);
  }
}

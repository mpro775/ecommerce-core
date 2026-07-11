import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PERMISSIONS } from '../auth/constants/permission.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { getRequestContext } from '../common/utils/request-context.util';
import { RequirePermissions } from '../rbac/decorators/permissions.decorator';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { TenantGuard } from '../tenancy/guards/tenant.guard';
import { METRIC_DISPLAY_NAMES, type SaasMetricKey } from './constants/saas-metrics.constants';
import { CancelSubscriptionDto } from './dto/cancel-subscription.dto';
import { ChangeSubscriptionPlanDto } from './dto/change-subscription-plan.dto';
import { ListSubscriptionInvoicesQueryDto } from './dto/list-subscription-invoices-query.dto';
import { ListSubscriptionReceiptsQueryDto } from './dto/list-subscription-receipts-query.dto';
import { ValidateSubscriptionCouponDto } from './dto/subscription-coupon.dto';
import { UploadSubscriptionReceiptDto } from './dto/upload-subscription-receipt.dto';
import { SaasService, type StoreSubscriptionResponse } from './saas.service';

interface UsageItem {
  metricKey: SaasMetricKey;
  displayName: string;
  used: number;
  limit: number | null;
  resetPeriod: string;
  percentage: number | null;
  isOverLimit: boolean;
}

interface UsageResponse {
  usage: UsageItem[];
  plan: {
    code: string;
    name: string;
  };
  status: string;
}

@ApiTags('billing')
@ApiBearerAuth()
@Controller('billing')
@UseGuards(AccessTokenGuard, TenantGuard, PermissionsGuard)
export class BillingController {
  constructor(private readonly saasService: SaasService) {}

  @Get('subscription')
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({ description: 'Get current store subscription and usage snapshot' })
  async getCurrentSubscription(
    @CurrentUser() currentUser: AuthUser,
  ): Promise<StoreSubscriptionResponse> {
    return this.saasService.getCurrentStoreSubscription(currentUser);
  }

  @Get('center')
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({ description: 'Get merchant billing center aggregate data' })
  async getBillingCenter(@CurrentUser() currentUser: AuthUser) {
    return this.saasService.getMerchantBillingCenter(currentUser);
  }

  @Get('usage')
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({ description: 'Get detailed usage with percentage and limit warnings' })
  async getDetailedUsage(@CurrentUser() currentUser: AuthUser): Promise<UsageResponse> {
    const subscription = await this.saasService.getCurrentStoreSubscription(currentUser);

    const usage: UsageItem[] = subscription.usage.map((item) => ({
      metricKey: item.metricKey as SaasMetricKey,
      displayName: METRIC_DISPLAY_NAMES[item.metricKey as SaasMetricKey] ?? item.metricKey,
      used: item.used,
      limit: item.limit,
      resetPeriod: item.resetPeriod,
      percentage: item.limit !== null ? Math.round((item.used / item.limit) * 100) : null,
      isOverLimit: item.limit !== null && item.used >= item.limit,
    }));

    return {
      usage,
      plan: {
        code: subscription.plan.code,
        name: subscription.plan.name,
      },
      status: subscription.status,
    };
  }

  @Get('plans')
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({
    description: 'List available subscription plans for merchant upgrade/downgrade',
  })
  async listStorePlans() {
    return this.saasService.listStoreAvailablePlans();
  }

  @Post('coupons/validate')
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({ description: 'Validate a subscription coupon for a target plan' })
  async validateCoupon(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: ValidateSubscriptionCouponDto,
  ) {
    return this.saasService.validateSubscriptionCoupon(currentUser, body);
  }

  @Post('coupons/redeem')
  @RequirePermissions(PERMISSIONS.storeWrite)
  @ApiOkResponse({ description: 'Redeem a subscription coupon for a target plan' })
  async redeemCoupon(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: ValidateSubscriptionCouponDto,
    @Req() request: Request,
  ) {
    return this.saasService.redeemSubscriptionCoupon(currentUser, body, getRequestContext(request));
  }

  @Post('subscription/upgrade')
  @RequirePermissions(PERMISSIONS.storeWrite)
  @ApiOkResponse({ description: 'Upgrade store subscription' })
  async upgradeSubscription(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: ChangeSubscriptionPlanDto,
    @Req() request: Request,
  ) {
    return this.saasService.changeCurrentStorePlan(
      currentUser,
      body,
      getRequestContext(request),
      'upgrade',
    );
  }

  @Post('subscription/downgrade')
  @RequirePermissions(PERMISSIONS.storeWrite)
  @ApiOkResponse({ description: 'Downgrade store subscription' })
  async downgradeSubscription(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: ChangeSubscriptionPlanDto,
    @Req() request: Request,
  ) {
    return this.saasService.changeCurrentStorePlan(
      currentUser,
      body,
      getRequestContext(request),
      'downgrade',
    );
  }

  @Post('subscription/cancel')
  @RequirePermissions(PERMISSIONS.storeWrite)
  @ApiOkResponse({ description: 'Request merchant subscription cancellation' })
  async cancelSubscription(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: CancelSubscriptionDto,
    @Req() request: Request,
  ): Promise<StoreSubscriptionResponse> {
    return this.saasService.requestMerchantCancellation(
      currentUser,
      body,
      getRequestContext(request),
    );
  }

  @Get('invoices')
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({ description: 'List subscription invoices for current store' })
  async listInvoices(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: ListSubscriptionInvoicesQueryDto,
  ) {
    return this.saasService.listStoreInvoices(currentUser, query);
  }

  @Post('receipts')
  @RequirePermissions(PERMISSIONS.storeWrite)
  @ApiOkResponse({ description: 'Upload a manual subscription payment receipt for review' })
  async uploadReceipt(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: UploadSubscriptionReceiptDto,
    @Req() request: Request,
  ) {
    return this.saasService.uploadSubscriptionReceipt(
      currentUser,
      body,
      getRequestContext(request),
    );
  }

  @Get('receipts')
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({ description: 'List current store subscription payment receipts' })
  async listReceipts(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: ListSubscriptionReceiptsQueryDto,
  ) {
    return this.saasService.listStoreSubscriptionReceipts(currentUser, query);
  }
}

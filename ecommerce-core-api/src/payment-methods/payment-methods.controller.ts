import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PERMISSIONS } from '../auth/constants/permission.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { getRequestContext } from '../common/utils/request-context.util';
import { MediaService } from '../media/media.service';
import { PLATFORM_PERMISSIONS } from '../platform/constants/platform-permissions.constants';
import { RequirePlatformPermissions } from '../platform/decorators/require-platform-permissions.decorator';
import { RequirePlatformStepUp } from '../platform/decorators/require-platform-step-up.decorator';
import { PlatformAccessTokenGuard } from '../platform/guards/platform-access-token.guard';
import { PlatformPermissionsGuard } from '../platform/guards/platform-permissions.guard';
import { PlatformStepUpGuard } from '../platform/guards/platform-step-up.guard';
import { RequirePermissions } from '../rbac/decorators/permissions.decorator';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { StoreResolverService } from '../storefront/store-resolver.service';
import { TenantGuard } from '../tenancy/guards/tenant.guard';
import {
  TogglePlatformPaymentMethodDto,
  UpsertPlatformPaymentMethodDto,
} from './dto/platform-payment-method.dto';
import {
  StorefrontConfirmReceiptDto,
  StorefrontPresignReceiptDto,
} from './dto/storefront-payment-receipt.dto';
import {
  ToggleStorePaymentMethodDto,
  UpdateStorePaymentMethodDto,
} from './dto/store-payment-method.dto';
import { PaymentMethodsService } from './payment-methods.service';

@ApiTags('platform-payment-methods')
@ApiBearerAuth()
@Controller('platform/payment-methods')
@UseGuards(PlatformAccessTokenGuard, PlatformPermissionsGuard, PlatformStepUpGuard)
export class PlatformPaymentMethodsController {
  constructor(private readonly service: PaymentMethodsService) {}

  @Get()
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.paymentMethodsRead)
  async list() {
    return this.service.listPlatform();
  }

  @Post()
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.paymentMethodsWrite)
  @RequirePlatformStepUp()
  async create(@Body() body: UpsertPlatformPaymentMethodDto) {
    return this.service.createPlatform(body);
  }

  @Patch(':id')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.paymentMethodsWrite)
  @RequirePlatformStepUp()
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpsertPlatformPaymentMethodDto,
  ) {
    return this.service.updatePlatform(id, body);
  }

  @Patch(':id/toggle')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.paymentMethodsWrite)
  @RequirePlatformStepUp()
  async toggle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: TogglePlatformPaymentMethodDto,
  ) {
    return this.service.togglePlatform(id, body.isEnabled);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.paymentMethodsWrite)
  @RequirePlatformStepUp()
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.service.deletePlatform(id);
  }
}

@ApiTags('merchant-payment-methods')
@ApiBearerAuth()
@Controller('merchant/payment-methods')
@UseGuards(AccessTokenGuard, TenantGuard, PermissionsGuard)
export class MerchantPaymentMethodsController {
  constructor(private readonly service: PaymentMethodsService) {}

  @Get('available')
  @RequirePermissions(PERMISSIONS.paymentsRead)
  async available() {
    return this.service.listAvailableForMerchant();
  }

  @Get()
  @RequirePermissions(PERMISSIONS.paymentsRead)
  async list(@CurrentUser() currentUser: AuthUser) {
    return this.service.listStore(currentUser);
  }

  @Post(':platformPaymentMethodId/enable')
  @RequirePermissions(PERMISSIONS.paymentsWrite)
  async enable(
    @CurrentUser() currentUser: AuthUser,
    @Param('platformPaymentMethodId', ParseUUIDPipe) platformPaymentMethodId: string,
  ) {
    return this.service.enableStoreMethod(currentUser, platformPaymentMethodId);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.paymentsWrite)
  async update(
    @CurrentUser() currentUser: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateStorePaymentMethodDto,
  ) {
    return this.service.updateStoreMethod(currentUser, id, body);
  }

  @Patch(':id/toggle')
  @RequirePermissions(PERMISSIONS.paymentsWrite)
  async toggle(
    @CurrentUser() currentUser: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ToggleStorePaymentMethodDto,
  ) {
    return this.service.toggleStoreMethod(currentUser, id, body.isEnabled);
  }
}

@ApiTags('storefront-payment-methods')
@Controller('sf')
@Public()
export class StorefrontPaymentMethodsController {
  constructor(
    private readonly service: PaymentMethodsService,
    private readonly storeResolverService: StoreResolverService,
    private readonly mediaService: MediaService,
  ) {}

  @Get('payment-methods')
  @ApiOkResponse({ description: 'List enabled payment methods for this storefront' })
  async listStorefront(@Req() request: Request) {
    const store = await this.storeResolverService.resolve(request);
    return this.service.listStorefront(store.id);
  }

  @Post('payment-receipts/presign')
  @HttpCode(HttpStatus.OK)
  async presignReceipt(@Req() request: Request, @Body() body: StorefrontPresignReceiptDto) {
    const store = await this.storeResolverService.resolve(request);
    return this.mediaService.createStorefrontReceiptPresignedUpload(store.id, body);
  }

  @Post('payment-receipts')
  @HttpCode(HttpStatus.OK)
  async confirmReceipt(@Req() request: Request, @Body() body: StorefrontConfirmReceiptDto) {
    const store = await this.storeResolverService.resolve(request);
    return this.mediaService.confirmStorefrontReceiptUpload(
      store.id,
      body,
      getRequestContext(request),
    );
  }
}

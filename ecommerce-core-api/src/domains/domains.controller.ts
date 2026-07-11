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
import { PERMISSIONS } from '../auth/constants/permission.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { getRequestContext } from '../common/utils/request-context.util';
import { RequirePermissions } from '../rbac/decorators/permissions.decorator';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { TenantGuard } from '../tenancy/guards/tenant.guard';
import { CreateDomainDto } from './dto/create-domain.dto';
import {
  DomainsService,
  type CompleteDomainSetupResponse,
  type StoreDomainResponse,
} from './domains.service';

@ApiTags('domains')
@ApiBearerAuth()
@Controller('domains')
@UseGuards(AccessTokenGuard, TenantGuard, PermissionsGuard)
export class DomainsController {
  constructor(private readonly domainsService: DomainsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.domainsWrite)
  @ApiCreatedResponse({ description: 'Register custom domain and generate verification token' })
  async create(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: CreateDomainDto,
    @Req() request: Request,
  ): Promise<StoreDomainResponse> {
    return this.domainsService.create(currentUser, body, getRequestContext(request));
  }

  @Get()
  @RequirePermissions(PERMISSIONS.domainsRead)
  @ApiOkResponse({ description: 'List registered custom domains' })
  async list(@CurrentUser() currentUser: AuthUser): Promise<StoreDomainResponse[]> {
    return this.domainsService.list(currentUser);
  }

  @Post(':domainId/verify')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.domainsWrite)
  @ApiOkResponse({ description: 'Verify custom domain using DNS TXT token' })
  async verify(
    @CurrentUser() currentUser: AuthUser,
    @Param('domainId', ParseUUIDPipe) domainId: string,
    @Req() request: Request,
  ): Promise<StoreDomainResponse> {
    return this.domainsService.verify(currentUser, domainId, getRequestContext(request));
  }

  @Post(':domainId/activate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.domainsWrite)
  @ApiOkResponse({ description: 'Activate verified domain for Cloudflare edge SSL' })
  async activate(
    @CurrentUser() currentUser: AuthUser,
    @Param('domainId', ParseUUIDPipe) domainId: string,
    @Req() request: Request,
  ): Promise<StoreDomainResponse> {
    return this.domainsService.activate(currentUser, domainId, getRequestContext(request));
  }

  @Post(':domainId/sync-ssl')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.domainsWrite)
  @ApiOkResponse({ description: 'Sync SSL state from provider (Cloudflare)' })
  async syncSsl(
    @CurrentUser() currentUser: AuthUser,
    @Param('domainId', ParseUUIDPipe) domainId: string,
    @Req() request: Request,
  ): Promise<StoreDomainResponse> {
    return this.domainsService.syncSslStatus(currentUser, domainId, getRequestContext(request));
  }

  @Post(':domainId/complete-setup')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.domainsWrite)
  @ApiOkResponse({ description: 'Verify DNS, provision Cloudflare hostname, and complete setup' })
  async completeSetup(
    @CurrentUser() currentUser: AuthUser,
    @Param('domainId', ParseUUIDPipe) domainId: string,
    @Req() request: Request,
  ): Promise<CompleteDomainSetupResponse> {
    return this.domainsService.completeSetup(currentUser, domainId, getRequestContext(request));
  }

  @Delete(':domainId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.domainsWrite)
  @ApiNoContentResponse({ description: 'Delete custom domain registration' })
  async remove(
    @CurrentUser() currentUser: AuthUser,
    @Param('domainId', ParseUUIDPipe) domainId: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.domainsService.remove(currentUser, domainId, getRequestContext(request));
  }
}

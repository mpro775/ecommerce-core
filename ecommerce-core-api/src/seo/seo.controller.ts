import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../auth/constants/permission.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { RequirePermissions } from '../rbac/decorators/permissions.decorator';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { TenantGuard } from '../tenancy/guards/tenant.guard';
import { BootstrapStorePagesDto } from './dto/bootstrap-store-pages.dto';
import { CreateStorePageDto } from './dto/create-store-page.dto';
import { SeoAutoFixDto, SeoSuggestionDto } from './dto/seo-suggestion.dto';
import { UpdateStorePageDto } from './dto/update-store-page.dto';
import { UpdateStoreSeoSettingsDto } from './dto/update-store-seo-settings.dto';
import { SeoService } from './seo.service';

@ApiTags('seo')
@ApiBearerAuth()
@Controller()
@UseGuards(AccessTokenGuard, TenantGuard, PermissionsGuard)
export class SeoController {
  constructor(private readonly seoService: SeoService) {}

  @Get('merchant/seo/settings')
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({ description: 'Get current store SEO settings' })
  getSettings(@CurrentUser() user: AuthUser) {
    return this.seoService.getSettings(user);
  }

  @Patch('merchant/seo/settings')
  @RequirePermissions(PERMISSIONS.storeWrite)
  @ApiOkResponse({ description: 'Update current store SEO settings' })
  updateSettings(@CurrentUser() user: AuthUser, @Body() body: UpdateStoreSeoSettingsDto) {
    return this.seoService.updateSettings(user, body);
  }

  @Get('merchant/seo/audit')
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({ description: 'Get SEO audit counts and score' })
  audit(@CurrentUser() user: AuthUser) {
    return this.seoService.audit(user);
  }

  @Get('merchant/seo/audit/details')
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({ description: 'Get detailed SEO audit issues' })
  auditDetails(@CurrentUser() user: AuthUser) {
    return this.seoService.auditDetails(user);
  }

  @Post('merchant/seo/suggestions')
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({ description: 'Generate SEO suggestions from store data' })
  suggestions(@CurrentUser() user: AuthUser, @Body() body: SeoSuggestionDto) {
    return this.seoService.suggestions(user, body);
  }

  @Post('merchant/seo/auto-fix')
  @RequirePermissions(PERMISSIONS.storeWrite)
  @ApiOkResponse({ description: 'Auto-generate missing SEO fields' })
  autoFix(@CurrentUser() user: AuthUser, @Body() body: SeoAutoFixDto) {
    return this.seoService.autoFix(user, body);
  }

  @Get('merchant/seo/fix-logs')
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({ description: 'Get latest SEO fix logs' })
  fixLogs(@CurrentUser() user: AuthUser) {
    return this.seoService.fixLogs(user);
  }

  @Get('merchant/pages')
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({ description: 'List store pages' })
  listPages(@CurrentUser() user: AuthUser) {
    return this.seoService.listPages(user);
  }

  @Get('merchant/pages/:id')
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({ description: 'Get store page' })
  getPage(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.seoService.getPage(user, id);
  }

  @Post('merchant/pages')
  @RequirePermissions(PERMISSIONS.storeWrite)
  @ApiOkResponse({ description: 'Create store page' })
  createPage(@CurrentUser() user: AuthUser, @Body() body: CreateStorePageDto) {
    return this.seoService.createPage(user, body);
  }

  @Post('merchant/pages/bootstrap')
  @RequirePermissions(PERMISSIONS.storeWrite)
  @ApiOkResponse({ description: 'Create or refresh core store pages from store data' })
  bootstrapPages(@CurrentUser() user: AuthUser, @Body() body: BootstrapStorePagesDto) {
    return this.seoService.bootstrapPages(user, body);
  }

  @Patch('merchant/pages/:id')
  @RequirePermissions(PERMISSIONS.storeWrite)
  @ApiOkResponse({ description: 'Update store page' })
  updatePage(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateStorePageDto,
  ) {
    return this.seoService.updatePage(user, id, body);
  }

  @Patch('merchant/pages/:id/publish')
  @RequirePermissions(PERMISSIONS.storeWrite)
  @ApiOkResponse({ description: 'Publish store page' })
  publishPage(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.seoService.publishPage(user, id);
  }

  @Patch('merchant/pages/:id/archive')
  @RequirePermissions(PERMISSIONS.storeWrite)
  @ApiOkResponse({ description: 'Archive store page' })
  archivePage(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.seoService.archivePage(user, id);
  }

  @Delete('merchant/pages/:id')
  @RequirePermissions(PERMISSIONS.storeWrite)
  @ApiOkResponse({ description: 'Delete store page' })
  deletePage(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.seoService.deletePage(user, id);
  }
}

import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
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
import { ApplyThemeDesignPresetDto } from './dto/apply-theme-design-preset.dto';
import { ApplyThemeTemplateDto } from './dto/apply-theme-template.dto';
import { CreateThemePreviewTokenDto } from './dto/create-theme-preview-token.dto';
import { UpdateAccessibilitySettingsDto } from './dto/update-accessibility-settings.dto';
import { UpdateHomePageDto } from './dto/update-home-page.dto';
import { UpdateThemeDesignDto } from './dto/update-theme-design.dto';
import { UpdateThemeDraftDto } from './dto/update-theme-draft.dto';
import { ValidateThemeDesignContrastDto } from './dto/validate-theme-design-contrast.dto';
import {
  ThemePreviewTokenResponse,
  ThemesService,
  type ThemeContrastValidationResponse,
  type ThemeDesignPresetListResponse,
  type ThemeDesignResponse,
  type ThemeRegistryResponse,
  type ThemeStateResponse,
  type ThemeStatusResponse,
  type ThemeTemplateListResponse,
  type ThemeVersionListResponse,
  type ThemeHomePageResponse,
} from './themes.service';

@ApiTags('themes')
@ApiBearerAuth()
@Controller('themes')
@UseGuards(AccessTokenGuard, TenantGuard, PermissionsGuard)
export class ThemesController {
  constructor(private readonly themesService: ThemesService) {}

  @Get('templates')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @RequirePermissions(PERMISSIONS.themesRead)
  @ApiOkResponse({ description: 'List available storefront theme templates' })
  async listTemplates(): Promise<ThemeTemplateListResponse> {
    return this.themesService.listTemplates();
  }

  @Get('component-keys')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @RequirePermissions(PERMISSIONS.themesRead)
  @ApiOkResponse({ description: 'List supported storefront component template keys' })
  async listComponentKeys(): Promise<ThemeRegistryResponse> {
    return this.themesService.getRegistry();
  }

  @Get('registry')
  @RequirePermissions(PERMISSIONS.themesRead)
  @ApiOkResponse({ description: 'Get supported storefront component template keys' })
  async getRegistry(): Promise<ThemeRegistryResponse> {
    return this.themesService.getRegistry();
  }

  @Get('section-registry')
  @RequirePermissions(PERMISSIONS.themesRead)
  @ApiOkResponse({ description: 'Get supported home page composer sections' })
  async getSectionRegistry() {
    return this.themesService.getHomeSectionRegistry();
  }

  @Get('current/home')
  @RequirePermissions(PERMISSIONS.themesRead)
  @ApiOkResponse({ description: 'Get current draft home page sections' })
  async getHomePage(@CurrentUser() currentUser: AuthUser): Promise<ThemeHomePageResponse> {
    return this.themesService.getHomePage(currentUser);
  }

  @Put('current/home')
  @RequirePermissions(PERMISSIONS.themesWrite)
  @ApiOkResponse({ description: 'Update current draft home page sections' })
  async updateHomePage(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: UpdateHomePageDto,
    @Req() request: Request,
  ): Promise<ThemeStateResponse> {
    return this.themesService.updateHomePage(
      currentUser,
      body as unknown as Record<string, unknown>,
      getRequestContext(request),
    );
  }

  @Post('current/home/reset')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.themesWrite)
  @ApiOkResponse({ description: 'Reset current draft home page sections to defaults' })
  async resetHomePage(
    @CurrentUser() currentUser: AuthUser,
    @Req() request: Request,
  ): Promise<ThemeStateResponse> {
    return this.themesService.resetHomePage(currentUser, getRequestContext(request));
  }

  @Post('current/home/restore-published')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.themesWrite, PERMISSIONS.themesRollback)
  @ApiOkResponse({ description: 'Restore published home page sections into draft' })
  async restorePublishedHomePage(
    @CurrentUser() currentUser: AuthUser,
    @Req() request: Request,
  ): Promise<ThemeStateResponse> {
    return this.themesService.restorePublishedHomePage(currentUser, getRequestContext(request));
  }

  @Post('current/home/validate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.themesRead)
  @ApiOkResponse({ description: 'Validate home page sections' })
  async validateHomePage(@Body() body: UpdateHomePageDto): Promise<ThemeHomePageResponse> {
    return this.themesService.validateHomePage(body as unknown as Record<string, unknown>);
  }

  @Get('draft')
  @RequirePermissions(PERMISSIONS.themesRead)
  @ApiOkResponse({ description: 'Get draft and published theme state' })
  async getDraft(@CurrentUser() currentUser: AuthUser): Promise<ThemeStateResponse> {
    return this.themesService.getDraft(currentUser);
  }

  @Get('current/status')
  @RequirePermissions(PERMISSIONS.themesRead)
  @ApiOkResponse({ description: 'Get current theme editor status' })
  async getStatus(@CurrentUser() currentUser: AuthUser): Promise<ThemeStatusResponse> {
    return this.themesService.getStatus(currentUser);
  }

  @Get('current/design')
  @RequirePermissions(PERMISSIONS.themesRead)
  @ApiOkResponse({ description: 'Get current draft theme design identity' })
  async getDesign(@CurrentUser() currentUser: AuthUser): Promise<ThemeDesignResponse> {
    return this.themesService.getDesign(currentUser);
  }

  @Get('design-presets')
  @RequirePermissions(PERMISSIONS.themesRead)
  @ApiOkResponse({ description: 'List built-in theme design presets' })
  async listDesignPresets(): Promise<ThemeDesignPresetListResponse> {
    return this.themesService.listDesignPresets();
  }

  @Post('design/validate-contrast')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.themesRead)
  @ApiOkResponse({ description: 'Validate theme design color contrast' })
  async validateDesignContrast(
    @Body() body: ValidateThemeDesignContrastDto,
  ): Promise<ThemeContrastValidationResponse> {
    return this.themesService.validateDesignContrast(body);
  }

  @Get('versions')
  @RequirePermissions(PERMISSIONS.themesRead)
  @ApiOkResponse({ description: 'List published theme versions' })
  async listVersions(@CurrentUser() currentUser: AuthUser): Promise<ThemeVersionListResponse> {
    return this.themesService.listVersions(currentUser);
  }

  @Put('draft')
  @RequirePermissions(PERMISSIONS.themesWrite)
  @ApiOkResponse({ description: 'Update draft theme config' })
  async updateDraft(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: UpdateThemeDraftDto,
    @Req() request: Request,
  ): Promise<ThemeStateResponse> {
    return this.themesService.updateDraft(currentUser, body, getRequestContext(request));
  }

  @Post('apply-template')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.themesWrite)
  @ApiOkResponse({ description: 'Apply a storefront theme template to the draft config' })
  async applyTemplate(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: ApplyThemeTemplateDto,
    @Req() request: Request,
  ): Promise<ThemeStateResponse> {
    return this.themesService.applyTemplate(
      currentUser,
      body.templateKey,
      getRequestContext(request),
    );
  }

  @Post('apply-template-and-publish')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.themesWrite, PERMISSIONS.themesPublish)
  @ApiOkResponse({ description: 'Apply a component template and publish it immediately' })
  async applyTemplateAndPublish(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: ApplyThemeTemplateDto,
    @Req() request: Request,
  ): Promise<{ ok: true; message: string; theme: Record<string, unknown> }> {
    return this.themesService.applyTemplateAndPublish(
      currentUser,
      body.templateKey,
      getRequestContext(request),
    );
  }

  @Post('current/restore-published')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.themesWrite, PERMISSIONS.themesRollback)
  @ApiOkResponse({ description: 'Restore published theme config into draft' })
  async restorePublished(
    @CurrentUser() currentUser: AuthUser,
    @Req() request: Request,
  ): Promise<ThemeStateResponse> {
    return this.themesService.restorePublished(currentUser, getRequestContext(request));
  }

  @Post('current/reset-template')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.themesWrite)
  @ApiOkResponse({ description: 'Reset current template draft settings to template defaults' })
  async resetTemplate(
    @CurrentUser() currentUser: AuthUser,
    @Req() request: Request,
  ): Promise<ThemeStateResponse> {
    return this.themesService.resetTemplate(currentUser, getRequestContext(request));
  }

  @Patch('current/design')
  @RequirePermissions(PERMISSIONS.themesWrite)
  @ApiOkResponse({ description: 'Update current draft theme design identity' })
  async updateDesign(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: UpdateThemeDesignDto,
    @Req() request: Request,
  ): Promise<ThemeStateResponse> {
    return this.themesService.updateDesign(currentUser, body, getRequestContext(request));
  }

  @Post('current/design/reset')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.themesWrite)
  @ApiOkResponse({ description: 'Reset current draft theme design identity' })
  async resetDesign(
    @CurrentUser() currentUser: AuthUser,
    @Req() request: Request,
  ): Promise<ThemeStateResponse> {
    return this.themesService.resetDesign(currentUser, getRequestContext(request));
  }

  @Post('current/design/restore-published')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.themesWrite, PERMISSIONS.themesRollback)
  @ApiOkResponse({ description: 'Restore published design identity into draft' })
  async restorePublishedDesign(
    @CurrentUser() currentUser: AuthUser,
    @Req() request: Request,
  ): Promise<ThemeStateResponse> {
    return this.themesService.restorePublishedDesign(currentUser, getRequestContext(request));
  }

  @Post('current/design/apply-preset')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.themesWrite)
  @ApiOkResponse({ description: 'Apply a design preset to current draft theme identity' })
  async applyDesignPreset(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: ApplyThemeDesignPresetDto,
    @Req() request: Request,
  ): Promise<ThemeStateResponse> {
    return this.themesService.applyDesignPreset(currentUser, body, getRequestContext(request));
  }

  @Post('publish')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.themesWrite, PERMISSIONS.themesPublish)
  @ApiOkResponse({ description: 'Publish current draft theme config' })
  async publish(
    @CurrentUser() currentUser: AuthUser,
    @Req() request: Request,
  ): Promise<ThemeStateResponse> {
    return this.themesService.publish(currentUser, getRequestContext(request));
  }

  @Post('versions/:version/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.themesWrite, PERMISSIONS.themesRollback)
  @ApiOkResponse({ description: 'Restore a published theme version to draft' })
  async restoreVersion(
    @CurrentUser() currentUser: AuthUser,
    @Param('version', ParseIntPipe) version: number,
    @Req() request: Request,
  ): Promise<ThemeStateResponse> {
    return this.themesService.restoreVersion(currentUser, version, getRequestContext(request));
  }

  @Post('preview-token')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @RequirePermissions(PERMISSIONS.themesWrite)
  @ApiOkResponse({ description: 'Create short-lived preview token for draft theme' })
  async createPreviewToken(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: CreateThemePreviewTokenDto,
    @Req() request: Request,
  ): Promise<ThemePreviewTokenResponse> {
    return this.themesService.createPreviewToken(currentUser, body, getRequestContext(request));
  }

  @Get(':id/accessibility/audit')
  @RequirePermissions(PERMISSIONS.themesRead)
  @ApiOkResponse({ description: 'Get current draft theme accessibility audit' })
  async getAccessibilityAudit(@CurrentUser() currentUser: AuthUser) {
    return this.themesService.getAccessibilityAudit(currentUser);
  }

  @Post(':id/accessibility/audit')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.themesWrite)
  @ApiOkResponse({ description: 'Run and persist current draft theme accessibility audit' })
  async runAccessibilityAudit(@CurrentUser() currentUser: AuthUser, @Req() request: Request) {
    return this.themesService.runAccessibilityAudit(currentUser, getRequestContext(request));
  }

  @Patch(':id/accessibility-settings')
  @RequirePermissions(PERMISSIONS.themesWrite)
  @ApiOkResponse({ description: 'Update draft theme accessibility settings' })
  async updateAccessibilitySettings(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: UpdateAccessibilitySettingsDto,
    @Req() request: Request,
  ): Promise<ThemeStateResponse> {
    return this.themesService.updateAccessibilitySettings(
      currentUser,
      body,
      getRequestContext(request),
    );
  }
}

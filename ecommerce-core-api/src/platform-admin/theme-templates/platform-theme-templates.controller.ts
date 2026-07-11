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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PLATFORM_PERMISSIONS } from '../../platform/constants/platform-permissions.constants';
import { CurrentPlatformUser } from '../../platform/decorators/current-platform-user.decorator';
import { RequirePlatformPermissions } from '../../platform/decorators/require-platform-permissions.decorator';
import { RequirePlatformStepUp } from '../../platform/decorators/require-platform-step-up.decorator';
import { PlatformAccessTokenGuard } from '../../platform/guards/platform-access-token.guard';
import { PlatformPermissionsGuard } from '../../platform/guards/platform-permissions.guard';
import { PlatformStepUpGuard } from '../../platform/guards/platform-step-up.guard';
import type { PlatformAdminUser } from '../../platform/interfaces/platform-admin-user.interface';
import { DuplicatePlatformThemeTemplateDto } from './dto/duplicate-platform-theme-template.dto';
import { ListPlatformThemeTemplatesQueryDto } from './dto/list-platform-theme-templates-query.dto';
import { PublishPlatformThemeTemplateDto } from './dto/publish-platform-theme-template.dto';
import { RestoreTemplateVersionDto } from './dto/restore-template-version.dto';
import { UpdateTemplateJsonSectionDto } from './dto/update-template-json-section.dto';
import { UpdateTemplateMediaDto } from './dto/update-template-media.dto';
import { UpsertPlatformThemeTemplateDto } from './dto/upsert-platform-theme-template.dto';
import { PlatformThemeTemplatesService } from './platform-theme-templates.service';

@ApiTags('platform-theme-templates')
@ApiBearerAuth()
@Controller('platform/theme-templates')
@UseGuards(PlatformAccessTokenGuard, PlatformPermissionsGuard, PlatformStepUpGuard)
export class PlatformThemeTemplatesController {
  constructor(private readonly service: PlatformThemeTemplatesService) {}

  @Get()
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.themeTemplatesRead)
  @ApiOkResponse({ description: 'List platform managed theme templates' })
  async list(@Query() query: ListPlatformThemeTemplatesQueryDto) {
    return this.service.list(query);
  }

  @Get('component-keys')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.themeTemplatesRead)
  @ApiOkResponse({ description: 'List component keys already registered in the template catalog' })
  async listComponentKeys() {
    return this.service.listComponentKeys();
  }

  @Get(':id')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.themeTemplatesRead)
  @ApiOkResponse({ description: 'Get platform theme template details' })
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }

  @Get(':id/production-readiness')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.themeTemplatesRead)
  @ApiOkResponse({ description: 'Run production readiness checks for a platform theme template' })
  async productionReadiness(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.productionReadiness(id);
  }

  @Get(':id/versions')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.themeTemplatesRead)
  @ApiOkResponse({ description: 'List platform theme template versions' })
  async versions(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.versions(id);
  }

  @Post()
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.themeTemplatesWrite)
  @RequirePlatformStepUp()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ description: 'Create platform theme template draft' })
  async create(@Body() body: UpsertPlatformThemeTemplateDto) {
    return this.service.create(body);
  }

  @Patch(':id')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.themeTemplatesWrite)
  @RequirePlatformStepUp()
  @ApiOkResponse({ description: 'Update platform theme template draft' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpsertPlatformThemeTemplateDto,
  ) {
    return this.service.update(id, body);
  }

  @Post(':id/publish')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.themeTemplatesPublish)
  @RequirePlatformStepUp()
  @ApiOkResponse({ description: 'Publish platform theme template to merchant catalog' })
  async publish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
    @Body() body: PublishPlatformThemeTemplateDto,
  ) {
    return this.service.publish(id, currentUser, body);
  }

  @Post(':id/archive')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.themeTemplatesArchive)
  @RequirePlatformStepUp()
  @ApiOkResponse({ description: 'Archive platform theme template' })
  async archive(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
  ) {
    return this.service.archive(id, currentUser);
  }

  @Post(':id/restore')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.themeTemplatesArchive)
  @RequirePlatformStepUp()
  @ApiOkResponse({ description: 'Restore archived platform theme template as draft' })
  async restore(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
  ) {
    return this.service.restore(id, currentUser);
  }

  @Post(':id/duplicate')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.themeTemplatesWrite)
  @RequirePlatformStepUp()
  @ApiCreatedResponse({ description: 'Duplicate platform theme template as draft' })
  async duplicate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
    @Body() body: DuplicatePlatformThemeTemplateDto,
  ) {
    return this.service.duplicate(id, currentUser, body);
  }

  @Post(':id/preview')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.themeTemplatesRead)
  @RequirePlatformStepUp()
  @ApiOkResponse({ description: 'Create a short-lived platform template preview URL' })
  async preview(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.createPreview(id);
  }

  @Post(':id/validate')
  @HttpCode(HttpStatus.OK)
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.themeTemplatesWrite)
  @ApiOkResponse({ description: 'Validate a persisted platform theme template draft' })
  async validateExisting(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
  ) {
    return this.service.validateExisting(id, currentUser);
  }

  @Post(':id/production-check')
  @HttpCode(HttpStatus.OK)
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.themeTemplatesWrite)
  @ApiOkResponse({ description: 'Run and record production check for a platform theme template' })
  async productionCheck(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
  ) {
    return this.service.productionReadiness(id, currentUser);
  }

  @Post(':id/versions/restore')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.themeTemplatesWrite)
  @RequirePlatformStepUp()
  @ApiOkResponse({ description: 'Restore a template version into draft config' })
  async restoreVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
    @Body() body: RestoreTemplateVersionDto,
  ) {
    return this.service.restoreVersion(id, body.version, currentUser);
  }

  @Patch(':id/media')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.themeTemplatesWrite)
  @RequirePlatformStepUp()
  @ApiOkResponse({ description: 'Update platform template media URLs' })
  async updateMedia(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateTemplateMediaDto) {
    return this.service.updateMedia(id, body);
  }

  @Post(':id/media/upload')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.themeTemplatesWrite)
  @RequirePlatformStepUp()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiOkResponse({ description: 'Upload and attach a platform template media image' })
  async uploadMedia(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile()
    file: { buffer: Buffer; mimetype: string; originalname: string; size: number } | undefined,
    @Body('type') type: string,
  ) {
    return this.service.uploadMedia(id, file, type);
  }

  @Patch(':id/design-defaults')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.themeTemplatesWrite)
  @RequirePlatformStepUp()
  @ApiOkResponse({ description: 'Update design defaults inside draft config' })
  async updateDesignDefaults(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateTemplateJsonSectionDto,
  ) {
    return this.service.updateDesignDefaults(id, body);
  }

  @Patch(':id/home-sections-defaults')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.themeTemplatesWrite)
  @RequirePlatformStepUp()
  @ApiOkResponse({ description: 'Update home sections defaults inside draft config' })
  async updateHomeSectionsDefaults(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateTemplateJsonSectionDto,
  ) {
    return this.service.updateHomeSectionsDefaults(id, body);
  }

  @Patch(':id/settings-schema')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.themeTemplatesWrite)
  @RequirePlatformStepUp()
  @ApiOkResponse({ description: 'Update template settings schema' })
  async updateSettingsSchema(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateTemplateJsonSectionDto,
  ) {
    return this.service.updateSettingsSchema(id, body);
  }

  @Patch(':id/capabilities')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.themeTemplatesWrite)
  @RequirePlatformStepUp()
  @ApiOkResponse({ description: 'Update template capabilities' })
  async updateCapabilities(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateTemplateJsonSectionDto,
  ) {
    return this.service.updateCapabilities(id, body);
  }

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.themeTemplatesWrite)
  @ApiOkResponse({ description: 'Validate a platform theme template draft payload' })
  async validate(@Body() body: UpsertPlatformThemeTemplateDto) {
    return this.service.validate(body);
  }
}

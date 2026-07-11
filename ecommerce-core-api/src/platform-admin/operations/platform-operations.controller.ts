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
import type { PlatformAdminUser } from '../../platform/interfaces/platform-admin-user.interface';
import { CreatePlatformAdminDto } from '../../saas/dto/create-platform-admin.dto';
import { CreatePlatformAutomationRuleDto } from '../../saas/dto/create-platform-automation-rule.dto';
import { CreatePlatformComplianceTaskDto } from '../../saas/dto/create-platform-compliance-task.dto';
import { CreatePlatformRiskViolationDto } from '../../saas/dto/create-platform-risk-violation.dto';
import { CreatePlatformRoleDto } from '../../saas/dto/create-platform-role.dto';
import { CreatePlatformSupportCaseDto } from '../../saas/dto/create-platform-support-case.dto';
import { PlatformInternalCommentDto } from '../../saas/dto/platform-internal-comment.dto';
import { TriggerPlatformAutomationRuleDto } from '../../saas/dto/trigger-platform-automation-rule.dto';
import { UpdatePlatformAdminDto } from '../../saas/dto/update-platform-admin.dto';
import { UpdatePlatformAutomationRuleStatusDto } from '../../saas/dto/update-platform-automation-rule-status.dto';
import { UpdatePlatformComplianceTaskStatusDto } from '../../saas/dto/update-platform-compliance-task-status.dto';
import { UpdatePlatformRiskViolationStatusDto } from '../../saas/dto/update-platform-risk-violation-status.dto';
import { UpdatePlatformRoleDto } from '../../saas/dto/update-platform-role.dto';
import { UpdatePlatformSettingsDto } from '../../saas/dto/update-platform-settings.dto';
import { UpdatePlatformSupportCaseDto } from '../../saas/dto/update-platform-support-case.dto';
import { SaasService } from '../../saas/saas.service';

@ApiTags('platform-admin')
@ApiBearerAuth()
@Controller('platform')
@UseGuards(PlatformAccessTokenGuard, PlatformPermissionsGuard, PlatformStepUpGuard)
export class PlatformOperationsController {
  constructor(private readonly saasService: SaasService) {}

  @Get('admins')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.adminsRead)
  @ApiOkResponse({ description: 'List platform admins' })
  async listAdmins() {
    return this.saasService.listPlatformAdmins();
  }

  @Post('admins')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.adminsWrite)
  @RequirePlatformStepUp()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ description: 'Create platform admin' })
  async createAdmin(
    @Body() body: CreatePlatformAdminDto,
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
    @Req() request: Request,
  ) {
    return this.saasService.createPlatformAdmin(body, currentUser, getRequestContext(request));
  }

  @Patch('admins/:adminId')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.adminsWrite)
  @RequirePlatformStepUp()
  @ApiOkResponse({ description: 'Update platform admin' })
  async updateAdmin(
    @Param('adminId', ParseUUIDPipe) adminId: string,
    @Body() body: UpdatePlatformAdminDto,
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
    @Req() request: Request,
  ) {
    return this.saasService.updatePlatformAdmin(
      adminId,
      body,
      currentUser,
      getRequestContext(request),
    );
  }

  @Get('roles')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.rolesRead)
  @ApiOkResponse({ description: 'List platform roles and permissions' })
  async listRoles() {
    return this.saasService.listPlatformRoles();
  }

  @Get('permissions')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.rolesRead)
  @ApiOkResponse({ description: 'List platform permission catalog' })
  async listPermissions() {
    return this.saasService.listPlatformPermissionCatalog();
  }

  @Post('roles')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.rolesWrite)
  @RequirePlatformStepUp()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ description: 'Create platform role' })
  async createRole(
    @Body() body: CreatePlatformRoleDto,
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
    @Req() request: Request,
  ) {
    return this.saasService.createPlatformRole(body, currentUser, getRequestContext(request));
  }

  @Patch('roles/:roleId')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.rolesWrite)
  @RequirePlatformStepUp()
  @ApiOkResponse({ description: 'Update platform role' })
  async updateRole(
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() body: UpdatePlatformRoleDto,
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
    @Req() request: Request,
  ) {
    return this.saasService.updatePlatformRole(
      roleId,
      body,
      currentUser,
      getRequestContext(request),
    );
  }

  @Get('settings')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.settingsRead)
  @ApiOkResponse({ description: 'List platform global settings' })
  async getPlatformSettings() {
    return this.saasService.getPlatformSettings();
  }

  @Patch('settings')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.settingsWrite)
  @RequirePlatformStepUp()
  @ApiOkResponse({ description: 'Update platform global settings' })
  async patchPlatformSettings(
    @Body() body: UpdatePlatformSettingsDto,
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
    @Req() request: Request,
  ) {
    return this.saasService.updatePlatformSettings(body, currentUser, getRequestContext(request));
  }

  @Get('automation/rules')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.automationRead)
  @ApiOkResponse({ description: 'List platform automation rules' })
  async listAutomationRules() {
    return this.saasService.listPlatformAutomationRules();
  }

  @Post('automation/rules')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.automationWrite)
  @RequirePlatformStepUp()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ description: 'Create platform automation rule' })
  async createAutomationRule(
    @Body() body: CreatePlatformAutomationRuleDto,
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
    @Req() request: Request,
  ) {
    return this.saasService.createPlatformAutomationRule(
      body,
      currentUser,
      getRequestContext(request),
    );
  }

  @Patch('automation/rules/:ruleId/status')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.automationWrite)
  @RequirePlatformStepUp()
  @ApiOkResponse({ description: 'Enable/disable automation rule' })
  async updateAutomationRuleStatus(
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
    @Body() body: UpdatePlatformAutomationRuleStatusDto,
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
    @Req() request: Request,
  ) {
    return this.saasService.updatePlatformAutomationRuleStatus(
      ruleId,
      body,
      currentUser,
      getRequestContext(request),
    );
  }

  @Post('automation/rules/:ruleId/run')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.automationRun)
  @RequirePlatformStepUp()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ description: 'Trigger automation rule run manually' })
  async runAutomationRule(
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
    @Body() body: TriggerPlatformAutomationRuleDto,
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
    @Req() request: Request,
  ) {
    return this.saasService.triggerPlatformAutomationRule(
      ruleId,
      body,
      currentUser,
      getRequestContext(request),
    );
  }

  @Get('automation/runs')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.automationRead)
  @ApiOkResponse({ description: 'List recent platform automation runs' })
  async listAutomationRuns(@Query('limit') limit?: string) {
    const parsed = limit ? Number(limit) : 100;
    return this.saasService.listPlatformAutomationRuns(Number.isFinite(parsed) ? parsed : 100);
  }

  @Get('support/cases')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.supportRead)
  @ApiOkResponse({ description: 'List platform support cases' })
  async listSupportCases(@Query('limit') limit?: string) {
    const parsed = limit ? Number(limit) : 100;
    return this.saasService.listPlatformSupportCases(Number.isFinite(parsed) ? parsed : 100);
  }

  @Get('support/cases/export.csv')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.supportRead)
  @ApiOkResponse({ description: 'Export support cases as CSV' })
  async exportSupportCasesCsv() {
    return this.saasService.exportPlatformSupportCasesCsv();
  }

  @Get('support/cases/:caseId')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.supportRead)
  @ApiOkResponse({ description: 'Get support case details' })
  async getSupportCase(@Param('caseId', ParseUUIDPipe) caseId: string) {
    return this.saasService.getPlatformSupportCaseById(caseId);
  }

  @Post('support/cases')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.supportWrite)
  @RequirePlatformStepUp()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ description: 'Create support case' })
  async createSupportCase(
    @Body() body: CreatePlatformSupportCaseDto,
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
    @Req() request: Request,
  ) {
    return this.saasService.createPlatformSupportCase(
      body,
      currentUser,
      getRequestContext(request),
    );
  }

  @Patch('support/cases/:caseId')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.supportWrite)
  @RequirePlatformStepUp()
  @ApiOkResponse({ description: 'Update support case status/assignment' })
  async updateSupportCase(
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Body() body: UpdatePlatformSupportCaseDto,
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
    @Req() request: Request,
  ) {
    return this.saasService.updatePlatformSupportCase(
      caseId,
      body,
      currentUser,
      getRequestContext(request),
    );
  }

  @Post('support/cases/:caseId/comments')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.supportWrite)
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ description: 'Add internal support case comment' })
  async addSupportCaseComment(
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Body() body: PlatformInternalCommentDto,
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
    @Req() request: Request,
  ) {
    return this.saasService.addPlatformSupportCaseComment(
      caseId,
      body,
      currentUser,
      getRequestContext(request),
    );
  }

  @Get('risk/violations')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.riskRead)
  @ApiOkResponse({ description: 'List risk violations' })
  async listRiskViolations(@Query('limit') limit?: string) {
    const parsed = limit ? Number(limit) : 100;
    return this.saasService.listPlatformRiskViolations(Number.isFinite(parsed) ? parsed : 100);
  }

  @Get('risk/violations/export.csv')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.riskRead)
  @ApiOkResponse({ description: 'Export risk violations as CSV' })
  async exportRiskViolationsCsv() {
    return this.saasService.exportPlatformRiskViolationsCsv();
  }

  @Get('risk/violations/:violationId')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.riskRead)
  @ApiOkResponse({ description: 'Get risk violation details' })
  async getRiskViolation(@Param('violationId', ParseUUIDPipe) violationId: string) {
    return this.saasService.getPlatformRiskViolationById(violationId);
  }

  @Post('risk/violations')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.riskWrite)
  @RequirePlatformStepUp()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ description: 'Create risk violation' })
  async createRiskViolation(
    @Body() body: CreatePlatformRiskViolationDto,
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
    @Req() request: Request,
  ) {
    return this.saasService.createPlatformRiskViolation(
      body,
      currentUser,
      getRequestContext(request),
    );
  }

  @Patch('risk/violations/:violationId/status')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.riskWrite)
  @RequirePlatformStepUp()
  @ApiOkResponse({ description: 'Update risk violation status' })
  async updateRiskViolationStatus(
    @Param('violationId', ParseUUIDPipe) violationId: string,
    @Body() body: UpdatePlatformRiskViolationStatusDto,
    @Req() request: Request,
  ) {
    return this.saasService.updatePlatformRiskViolationStatus(
      violationId,
      body,
      getRequestContext(request),
    );
  }

  @Post('risk/violations/:violationId/notes')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.riskWrite)
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ description: 'Add risk violation internal note' })
  async addRiskViolationNote(
    @Param('violationId', ParseUUIDPipe) violationId: string,
    @Body() body: PlatformInternalCommentDto,
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
    @Req() request: Request,
  ) {
    return this.saasService.addPlatformRiskViolationNote(
      violationId,
      body,
      currentUser,
      getRequestContext(request),
    );
  }

  @Get('compliance/tasks')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.complianceRead)
  @ApiOkResponse({ description: 'List compliance tasks' })
  async listComplianceTasks(@Query('limit') limit?: string) {
    const parsed = limit ? Number(limit) : 100;
    return this.saasService.listPlatformComplianceTasks(Number.isFinite(parsed) ? parsed : 100);
  }

  @Get('compliance/tasks/export.csv')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.complianceRead)
  @ApiOkResponse({ description: 'Export compliance tasks as CSV' })
  async exportComplianceTasksCsv() {
    return this.saasService.exportPlatformComplianceTasksCsv();
  }

  @Get('compliance/tasks/:taskId')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.complianceRead)
  @ApiOkResponse({ description: 'Get compliance task details' })
  async getComplianceTask(@Param('taskId', ParseUUIDPipe) taskId: string) {
    return this.saasService.getPlatformComplianceTaskById(taskId);
  }

  @Post('compliance/tasks')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.complianceWrite)
  @RequirePlatformStepUp()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ description: 'Create compliance task' })
  async createComplianceTask(
    @Body() body: CreatePlatformComplianceTaskDto,
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
    @Req() request: Request,
  ) {
    return this.saasService.createPlatformComplianceTask(
      body,
      currentUser,
      getRequestContext(request),
    );
  }

  @Patch('compliance/tasks/:taskId/status')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.complianceWrite)
  @RequirePlatformStepUp()
  @ApiOkResponse({ description: 'Update compliance task status' })
  async updateComplianceTaskStatus(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() body: UpdatePlatformComplianceTaskStatusDto,
    @Req() request: Request,
  ) {
    return this.saasService.updatePlatformComplianceTaskStatus(
      taskId,
      body,
      getRequestContext(request),
    );
  }

  @Post('compliance/tasks/:taskId/comments')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.complianceWrite)
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ description: 'Add compliance task internal comment' })
  async addComplianceTaskComment(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() body: PlatformInternalCommentDto,
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
    @Req() request: Request,
  ) {
    return this.saasService.addPlatformComplianceTaskComment(
      taskId,
      body,
      currentUser,
      getRequestContext(request),
    );
  }

  @Post('compliance/tasks/:taskId/evidence')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.complianceWrite)
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ description: 'Add compliance task evidence' })
  async addComplianceTaskEvidence(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() body: PlatformInternalCommentDto,
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
    @Req() request: Request,
  ) {
    return this.saasService.addPlatformComplianceTaskEvidence(
      taskId,
      body,
      currentUser,
      getRequestContext(request),
    );
  }
}

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
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PLATFORM_PERMISSIONS } from '../platform/constants/platform-permissions.constants';
import { CurrentPlatformUser } from '../platform/decorators/current-platform-user.decorator';
import { RequirePlatformPermissions } from '../platform/decorators/require-platform-permissions.decorator';
import { RequirePlatformStepUp } from '../platform/decorators/require-platform-step-up.decorator';
import { PlatformAccessTokenGuard } from '../platform/guards/platform-access-token.guard';
import { PlatformPermissionsGuard } from '../platform/guards/platform-permissions.guard';
import { PlatformStepUpGuard } from '../platform/guards/platform-step-up.guard';
import type { PlatformAdminUser } from '../platform/interfaces/platform-admin-user.interface';
import { BulkUpdateQaAnswersDto } from './dto/bulk-update-qa-answers.dto';
import { CompleteQaRunDto } from './dto/complete-qa-run.dto';
import { ConfirmQaAttachmentDto } from './dto/confirm-qa-attachment.dto';
import { CreateQaAttachmentPresignDto } from './dto/create-qa-attachment-presign.dto';
import { CreateQaIssueDto } from './dto/create-qa-issue.dto';
import { CreateQaRunDto } from './dto/create-qa-run.dto';
import { QaDashboardQueryDto } from './dto/dashboard-query.dto';
import { QaExportQueryDto } from './dto/export-query.dto';
import { ImportScenarioDto } from './dto/import-scenario.dto';
import { QaIssuesQueryDto, QaListQueryDto, QaRunsQueryDto } from './dto/qa-query.dto';
import { UpdateQaIssueDto } from './dto/update-qa-issue.dto';
import { QaAttachmentsService } from './qa-attachments.service';
import { QaDashboardService } from './qa-dashboard.service';
import { QaReportsService } from './qa-reports.service';
import { QaService } from './qa.service';
import type { Response } from 'express';

@ApiTags('platform-qa')
@ApiBearerAuth()
@Controller('platform/qa')
@UseGuards(PlatformAccessTokenGuard, PlatformPermissionsGuard, PlatformStepUpGuard)
export class QaController {
  constructor(
    private readonly qaService: QaService,
    private readonly qaAttachmentsService: QaAttachmentsService,
    private readonly qaDashboardService: QaDashboardService,
    private readonly qaReportsService: QaReportsService,
  ) {}

  @Get('scenarios')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.qaScenariosRead)
  @ApiOkResponse({ description: 'List QA scenarios' })
  async listScenarios(@Query() query: QaListQueryDto) {
    return this.qaService.listScenarios(query);
  }

  @Get('scenarios/:scenarioId')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.qaScenariosRead)
  @ApiOkResponse({ description: 'Get QA scenario definition' })
  async getScenario(@Param('scenarioId') scenarioId: string) {
    return this.qaService.getScenario(scenarioId);
  }

  @Post('scenarios/import')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.qaScenariosWrite)
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ description: 'Import one QA scenario or all bundled scenarios' })
  async importScenarios(@Body() body: ImportScenarioDto) {
    return this.qaService.importScenarios(body);
  }

  @Post('runs')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.qaRunsWrite)
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ description: 'Create a QA test run' })
  async createRun(
    @Body() body: CreateQaRunDto,
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
  ) {
    return this.qaService.createRun(body, currentUser);
  }

  @Get('runs')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.qaRunsRead)
  @ApiOkResponse({ description: 'List QA test runs' })
  async listRuns(
    @Query() query: QaRunsQueryDto,
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
  ) {
    return this.qaService.listRuns(query, currentUser);
  }

  @Get('runs/:runId')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.qaRunsRead)
  @ApiOkResponse({ description: 'Get a QA run with answers, issues, attachments, and summary' })
  async getRun(
    @Param('runId', ParseUUIDPipe) runId: string,
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
  ) {
    return this.qaService.getRun(runId, currentUser);
  }

  @Patch('runs/:runId/answers')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.qaRunsWrite)
  @ApiOkResponse({ description: 'Autosave QA answers in bulk' })
  async updateAnswers(
    @Param('runId', ParseUUIDPipe) runId: string,
    @Body() body: BulkUpdateQaAnswersDto,
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
  ) {
    return this.qaService.updateAnswers(runId, body, currentUser);
  }

  @Post('runs/:runId/issues')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.qaRunsWrite)
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ description: 'Create an issue for a QA run' })
  async createIssue(
    @Param('runId', ParseUUIDPipe) runId: string,
    @Body() body: CreateQaIssueDto,
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
  ) {
    return this.qaService.createIssue(runId, body, currentUser);
  }

  @Get('issues')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.qaRunsRead)
  @ApiOkResponse({ description: 'List QA issues' })
  async listIssues(@Query() query: QaIssuesQueryDto) {
    return this.qaService.listIssues(query);
  }

  @Patch('issues/:issueId')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.qaIssuesManage)
  @ApiOkResponse({ description: 'Update QA issue triage fields' })
  async updateIssue(
    @Param('issueId', ParseUUIDPipe) issueId: string,
    @Body() body: UpdateQaIssueDto,
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
  ) {
    return this.qaService.updateIssue(issueId, body, currentUser);
  }

  @Post('runs/:runId/attachments/presign')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.qaRunsWrite)
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ description: 'Create a presigned QA attachment upload URL' })
  async presignAttachment(
    @Param('runId', ParseUUIDPipe) runId: string,
    @Body() body: CreateQaAttachmentPresignDto,
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
  ) {
    return this.qaAttachmentsService.createPresignedUpload(runId, body, currentUser);
  }

  @Post('runs/:runId/attachments/confirm')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.qaRunsWrite)
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ description: 'Confirm a QA attachment upload' })
  async confirmAttachment(
    @Param('runId', ParseUUIDPipe) runId: string,
    @Body() body: ConfirmQaAttachmentDto,
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
  ) {
    return this.qaAttachmentsService.confirmUpload(runId, body, currentUser);
  }

  @Get('attachments/:attachmentId/download')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.qaRunsRead)
  @ApiOkResponse({ description: 'Create a short-lived QA attachment download URL' })
  async downloadAttachment(
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
  ) {
    return this.qaAttachmentsService.createDownloadUrl(attachmentId, currentUser);
  }

  @Post('runs/:runId/complete')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.qaRunsWrite)
  @ApiOkResponse({ description: 'Complete and lock a QA run' })
  async completeRun(
    @Param('runId', ParseUUIDPipe) runId: string,
    @Body() body: CompleteQaRunDto,
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
  ) {
    return this.qaService.completeRun(runId, body, currentUser);
  }

  @Post('runs/:runId/pause')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.qaRunsWrite)
  @ApiOkResponse({ description: 'Pause a QA run for resume later' })
  async pauseRun(
    @Param('runId', ParseUUIDPipe) runId: string,
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
  ) {
    return this.qaService.pauseRun(runId, currentUser);
  }

  @Post('runs/:runId/reopen')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.qaIssuesManage)
  @RequirePlatformStepUp()
  @ApiOkResponse({ description: 'Reopen a completed QA run' })
  async reopenRun(
    @Param('runId', ParseUUIDPipe) runId: string,
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
  ) {
    return this.qaService.reopenRun(runId, currentUser);
  }

  @Get('runs/:runId/summary')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.qaRunsRead)
  @ApiOkResponse({ description: 'Get or calculate QA run summary' })
  async getSummary(
    @Param('runId', ParseUUIDPipe) runId: string,
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
  ) {
    return this.qaService.getSummary(runId, currentUser);
  }

  @Get('runs/:runId/report')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.qaRunsRead)
  @ApiOkResponse({ description: 'Get a full QA run report' })
  async getRunReport(
    @Param('runId', ParseUUIDPipe) runId: string,
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
  ) {
    return this.qaReportsService.getRunReport(runId, currentUser);
  }

  @Get('runs/:runId/export')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.qaRunsRead)
  @ApiOkResponse({ description: 'Export a QA run report as JSON or Markdown' })
  async exportRun(
    @Param('runId', ParseUUIDPipe) runId: string,
    @Query() query: QaExportQueryDto,
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
    @Res() response: Response,
  ) {
    const result = await this.qaReportsService.exportRun(
      runId,
      currentUser,
      query.format ?? 'json',
    );
    response.setHeader('content-type', result.contentType);
    response.setHeader(
      'content-disposition',
      `attachment; filename="qa-run-${runId}.${query.format === 'markdown' ? 'md' : 'json'}"`,
    );
    return response.send(result.body);
  }

  @Get('dashboard')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.qaRunsRead)
  @ApiOkResponse({ description: 'QA dashboard foundation metrics' })
  async getDashboard(@Query() query: QaDashboardQueryDto) {
    return this.qaDashboardService.getDashboard(query);
  }
}

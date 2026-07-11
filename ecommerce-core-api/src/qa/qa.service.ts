import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PlatformAdminUser } from '../platform/interfaces/platform-admin-user.interface';
import type { BulkUpdateQaAnswersDto } from './dto/bulk-update-qa-answers.dto';
import type { CompleteQaRunDto } from './dto/complete-qa-run.dto';
import type { CreateQaIssueDto } from './dto/create-qa-issue.dto';
import type { CreateQaRunDto } from './dto/create-qa-run.dto';
import type { ImportScenarioDto } from './dto/import-scenario.dto';
import type { QaIssuesQueryDto, QaListQueryDto, QaRunsQueryDto } from './dto/qa-query.dto';
import type { UpdateQaIssueDto } from './dto/update-qa-issue.dto';
import { QaImportService } from './qa-import.service';
import { QaRepository } from './qa.repository';
import { QaSummaryService } from './qa-summary.service';

@Injectable()
export class QaService {
  constructor(
    private readonly qaRepository: QaRepository,
    private readonly qaImportService: QaImportService,
    private readonly qaSummaryService: QaSummaryService,
  ) {}

  async importScenarios(body: ImportScenarioDto) {
    const input = body ?? {};
    if (Object.prototype.hasOwnProperty.call(input, 'scenario')) {
      return [await this.qaImportService.importScenario(input.scenario, input.publish ?? true)];
    }
    return this.qaImportService.importBundledScenarios(input.publish ?? true);
  }

  async listScenarios(query: QaListQueryDto) {
    return this.qaRepository.listScenarios(query);
  }

  async getScenario(scenarioId: string) {
    const bundle = await this.qaRepository.getScenarioBundle(scenarioId);
    if (!bundle) {
      throw new NotFoundException('QA scenario not found');
    }
    return bundle;
  }

  async createRun(body: CreateQaRunDto, user: PlatformAdminUser) {
    const scenario = await this.qaRepository.findScenarioByIdOrKey(body.scenarioId);
    if (!scenario) {
      throw new NotFoundException('QA scenario not found');
    }
    if (!scenario.is_active) {
      throw new BadRequestException('QA scenario is not active');
    }
    const bundle = await this.qaRepository.getScenarioBundle(scenario.id);
    if (!bundle) {
      throw new NotFoundException('QA scenario not found');
    }

    const openRun = await this.qaRepository.findOpenRun(scenario.id, user.id);
    const run = await this.qaRepository.createRun({
      scenario,
      snapshot: bundle,
      testerId: user.id,
      testerName: user.fullName,
      environment: body.environment,
      deviceType: body.deviceType,
      browser: body.browser,
      os: body.os,
      screenSize: body.screenSize,
      buildVersion: body.buildVersion,
      testRound: body.testRound,
      notes: body.notes,
    });
    await this.qaRepository.logRunEvent({
      runId: run.id,
      eventType: 'run_created',
      actorId: user.id,
      metadata: {
        scenarioKey: scenario.scenario_key,
        previousOpenRunId: openRun?.id ?? null,
      },
    });

    return {
      run,
      resumeCandidate: openRun
        ? {
            runId: openRun.id,
            status: openRun.status,
            lastSavedAt: openRun.last_saved_at,
          }
        : null,
    };
  }

  async listRuns(query: QaRunsQueryDto, user: PlatformAdminUser) {
    return this.qaRepository.listRuns({
      ...query,
      testerId: user.id,
      canReadAll: canManageQa(user),
    });
  }

  async getRun(runId: string, user: PlatformAdminUser) {
    const run = await this.getAccessibleRun(runId, user);
    const [answers, issues, attachments, summary] = await Promise.all([
      this.qaRepository.listAnswers(run.id),
      this.qaRepository.listRunIssues(run.id),
      this.qaRepository.listRunAttachments(run.id),
      this.qaSummaryService.getSummary(run.id),
    ]);
    return { run, answers, issues, attachments, summary };
  }

  async updateAnswers(runId: string, body: BulkUpdateQaAnswersDto, user: PlatformAdminUser) {
    const run = await this.getWritableRun(runId, user);
    const totalChecks = await this.qaRepository.countScenarioChecks(run.scenario_id);

    const result = await this.qaRepository.transaction(async (db) => {
      const answers = [];
      for (const answer of body.answers) {
        const target = await this.resolveAnswerTarget(run.scenario_id, answer);
        answers.push(
          await this.qaRepository.upsertAnswer(
            {
              run,
              phaseId: answer.phaseId,
              checkId: answer.checkId,
              questionId: answer.questionId,
              targetKey: target.targetKey,
              status: answer.status,
              value: answer.value,
              note: answer.note,
              rating: answer.rating,
              answeredBy: user.id,
            },
            db,
          ),
        );
      }

      const allAnswers = await this.qaRepository.listAnswers(run.id, db);
      const answeredChecks = allAnswers.filter((answer) => answer.check_id).length;
      const progressPercent =
        totalChecks > 0
          ? Math.min(100, Math.round((answeredChecks / totalChecks) * 10000) / 100)
          : 0;
      const updatedRun = await this.qaRepository.updateRunProgress(
        {
          runId: run.id,
          status: 'in_progress',
          currentPhaseId: body.currentPhaseId,
          currentPhaseKey: body.currentPhaseKey,
          currentCheckId: body.currentCheckId,
          currentCheckKey: body.currentCheckKey,
          progressPercent,
        },
        db,
      );
      await this.qaRepository.logRunEvent(
        {
          runId: run.id,
          eventType: 'answers_autosaved',
          actorId: user.id,
          metadata: { answers: answers.length, progressPercent },
        },
        db,
      );
      return { run: updatedRun, answers };
    });

    return result;
  }

  async createIssue(runId: string, body: CreateQaIssueDto, user: PlatformAdminUser) {
    const run = await this.getWritableRun(runId, user);
    await this.assertTargetsBelongToScenario(run.scenario_id, body);
    const issue = await this.qaRepository.createIssue({
      run,
      phaseId: body.phaseId,
      checkId: body.checkId,
      questionId: body.questionId,
      title: body.title,
      description: body.description,
      stepsToReproduce: body.stepsToReproduce,
      expectedResult: body.expectedResult,
      actualResult: body.actualResult,
      severity: body.severity,
      category: body.category,
      isBlocking: body.isBlocking,
      createdBy: user.id,
    });
    await this.qaRepository.logRunEvent({
      runId: run.id,
      eventType: 'issue_created',
      actorId: user.id,
      metadata: { issueId: issue.id, severity: issue.severity, isBlocking: issue.is_blocking },
    });
    return issue;
  }

  async listIssues(query: QaIssuesQueryDto) {
    return this.qaRepository.listIssues(query);
  }

  async updateIssue(issueId: string, body: UpdateQaIssueDto, user: PlatformAdminUser) {
    if (!canManageQa(user)) {
      throw new ForbiddenException('QA lead or admin permission is required');
    }
    const issue = await this.qaRepository.updateIssue(issueId, body);
    if (!issue) {
      throw new NotFoundException('QA issue not found');
    }
    return issue;
  }

  async completeRun(runId: string, body: CompleteQaRunDto, user: PlatformAdminUser) {
    const run = await this.getWritableRun(runId, user);
    const summary = await this.qaSummaryService.calculateAndPersist(run.id);
    const updatedRun = await this.qaRepository.updateRunProgress({
      runId: run.id,
      status: 'completed',
      progressPercent: Number(run.progress_percent),
      notes: body.notes ?? null,
      completedBy: user.id,
    });
    await this.qaRepository.logRunEvent({
      runId: run.id,
      eventType: 'run_completed',
      actorId: user.id,
      metadata: { summaryId: summary.id, readinessStatus: summary.readiness_status },
    });
    return { run: updatedRun, summary };
  }

  async pauseRun(runId: string, user: PlatformAdminUser) {
    const run = await this.getWritableRun(runId, user);
    const updatedRun = await this.qaRepository.updateRunProgress({
      runId: run.id,
      status: 'paused',
      progressPercent: Number(run.progress_percent),
    });
    await this.qaRepository.logRunEvent({
      runId: run.id,
      eventType: 'run_paused',
      actorId: user.id,
    });
    return updatedRun;
  }

  async reopenRun(runId: string, user: PlatformAdminUser) {
    if (!canManageQa(user)) {
      throw new ForbiddenException('QA lead or admin permission is required');
    }
    const run = await this.qaRepository.reopenRun(runId);
    if (!run) {
      throw new NotFoundException('QA run not found');
    }
    await this.qaRepository.logRunEvent({
      runId,
      eventType: 'run_reopened',
      actorId: user.id,
    });
    return run;
  }

  async getSummary(runId: string, user: PlatformAdminUser) {
    await this.getAccessibleRun(runId, user);
    const summary = await this.qaSummaryService.getSummary(runId);
    if (!summary) {
      return this.qaSummaryService.calculateAndPersist(runId);
    }
    return summary;
  }

  private async getAccessibleRun(runId: string, user: PlatformAdminUser) {
    const run = await this.qaRepository.findRunById(runId);
    if (!run) {
      throw new NotFoundException('QA run not found');
    }
    if (!canManageQa(user) && run.tester_id !== user.id) {
      throw new ForbiddenException('You do not have access to this QA run');
    }
    return run;
  }

  private async getWritableRun(runId: string, user: PlatformAdminUser) {
    const run = await this.getAccessibleRun(runId, user);
    if (run.locked_at || run.status === 'completed') {
      throw new ForbiddenException('QA run is completed and locked');
    }
    return run;
  }

  private async resolveAnswerTarget(
    scenarioId: string,
    answer: { phaseId: string; checkId?: string; questionId?: string },
  ): Promise<{ targetKey: string }> {
    const hasCheck = Boolean(answer.checkId);
    const hasQuestion = Boolean(answer.questionId);
    if (hasCheck === hasQuestion) {
      throw new BadRequestException('Answer must target exactly one checkId or questionId');
    }
    const phase = await this.qaRepository.findPhaseById(answer.phaseId, scenarioId);
    if (!phase) {
      throw new BadRequestException('phaseId does not belong to the QA run scenario');
    }
    if (answer.checkId) {
      const check = await this.qaRepository.findCheckById(answer.checkId, scenarioId);
      if (!check || check.phase_id !== answer.phaseId) {
        throw new BadRequestException('checkId does not belong to the selected phase');
      }
      return { targetKey: check.check_key };
    }
    const question = await this.qaRepository.findQuestionById(
      answer.questionId as string,
      scenarioId,
    );
    if (!question || question.phase_id !== answer.phaseId) {
      throw new BadRequestException('questionId does not belong to the selected phase');
    }
    return { targetKey: question.question_key };
  }

  private async assertTargetsBelongToScenario(
    scenarioId: string,
    input: { phaseId?: string; checkId?: string; questionId?: string },
  ): Promise<void> {
    if (input.phaseId && !(await this.qaRepository.findPhaseById(input.phaseId, scenarioId))) {
      throw new BadRequestException('phaseId does not belong to the QA run scenario');
    }
    if (input.checkId && !(await this.qaRepository.findCheckById(input.checkId, scenarioId))) {
      throw new BadRequestException('checkId does not belong to the QA run scenario');
    }
    if (
      input.questionId &&
      !(await this.qaRepository.findQuestionById(input.questionId, scenarioId))
    ) {
      throw new BadRequestException('questionId does not belong to the QA run scenario');
    }
  }
}

export function canManageQa(user: PlatformAdminUser): boolean {
  return (
    user.roleCodes.includes('super_admin') ||
    user.roleCodes.includes('admin') ||
    user.roleCodes.includes('qa_lead') ||
    user.permissions.includes('*') ||
    user.permissions.includes('platform.qa.scenarios.write') ||
    user.permissions.includes('platform.qa.issues.manage')
  );
}

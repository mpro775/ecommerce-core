import { Injectable, NotFoundException } from '@nestjs/common';
import type { PlatformAdminUser } from '../platform/interfaces/platform-admin-user.interface';
import type { QaAnswerRecord } from './entities/qa-answer.entity';
import type { QaIssueRecord } from './entities/qa-issue.entity';
import type { QaRunRecord } from './entities/qa-run.entity';
import { QaRepository } from './qa.repository';
import { canManageQa } from './qa.service';
import { calculateQaScore } from './utils/qa-score.util';
import { renderQaMarkdownReport } from './utils/qa-markdown-report.util';

export interface QaRunReport {
  run: {
    id: string;
    scenarioId: string;
    scenarioKey: string;
    scenarioTitle: string;
    testerName: string | null;
    environment: string | null;
    deviceType: string | null;
    browser: string | null;
    os: string | null;
    screenSize: string | null;
    buildVersion: string | null;
    testRound: string | null;
    status: string;
    startedAt: Date | string | null;
    completedAt: Date | string | null;
    updatedAt: Date | string;
  };
  progress: {
    totalChecks: number;
    answeredChecks: number;
    passCount: number;
    failCount: number;
    blockedCount: number;
    naCount: number;
    progressPercent: number;
  };
  score: {
    baseScore: number;
    issuePenalty: number;
    completionPenalty: number;
    finalScore: number;
    decision: string;
  };
  phases: Array<{
    phaseId: string | null;
    phaseKey: string | null;
    title: string;
    totalChecks: number;
    passCount: number;
    failCount: number;
    blockedCount: number;
    naCount: number;
    averageRating: number;
    mainIssues: Array<{
      id: string;
      title: string;
      severity: string;
      category: string;
      isBlocking: boolean;
    }>;
  }>;
  issues: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    blocking: number;
    items: Array<{
      id: string;
      title: string;
      severity: string;
      category: string;
      status: string;
      isBlocking: boolean;
      phaseId: string | null;
    }>;
  };
  attachments: {
    total: number;
    byTargetType: Record<string, number>;
  };
  recommendations: string[];
}

@Injectable()
export class QaReportsService {
  constructor(private readonly qaRepository: QaRepository) {}

  async getRunReport(runId: string, user: PlatformAdminUser): Promise<QaRunReport> {
    const run = await this.qaRepository.findRunById(runId);
    if (!run) throw new NotFoundException('QA run not found');
    if (!canManageQa(user) && run.tester_id !== user.id) {
      throw new NotFoundException('QA run not found');
    }

    const [answers, issues, attachments, totalChecks] = await Promise.all([
      this.qaRepository.listAnswers(runId),
      this.qaRepository.listRunIssues(runId),
      this.qaRepository.listRunAttachments(runId),
      this.qaRepository.countScenarioChecks(run.scenario_id),
    ]);
    const score = calculateQaScore({
      totalChecks,
      final: run.status === 'completed',
      answers: answers
        .filter((answer) => answer.check_id)
        .map((answer) => ({ phaseId: answer.phase_id, status: answer.status })),
      issues: issues.map((issue) => ({
        phaseId: issue.phase_id,
        severity: issue.severity,
        isBlocking: issue.is_blocking,
      })),
    });
    const scenarioSnapshot = readSnapshot(run.scenario_snapshot);

    return {
      run: {
        id: run.id,
        scenarioId: run.scenario_id,
        scenarioKey: run.scenario_key,
        scenarioTitle:
          scenarioSnapshot?.scenario?.title_ar ??
          scenarioSnapshot?.scenario?.title ??
          run.scenario_key,
        testerName: run.tester_name,
        environment: run.environment,
        deviceType: run.device_type,
        browser: run.browser,
        os: run.os,
        screenSize: run.screen_size,
        buildVersion: run.build_version,
        testRound: run.test_round,
        status: run.status,
        startedAt: run.started_at,
        completedAt: run.completed_at,
        updatedAt: run.updated_at,
      },
      progress: {
        totalChecks,
        answeredChecks: answers.filter((answer) => answer.check_id).length,
        passCount: score.passedChecks,
        failCount: score.failedChecks,
        blockedCount: score.blockedChecks,
        naCount: score.notApplicableChecks,
        progressPercent: Number(run.progress_percent),
      },
      score: {
        baseScore: score.scoreBreakdown.baseScore,
        issuePenalty: score.scoreBreakdown.issuePenalty,
        completionPenalty: score.scoreBreakdown.completionPenalty,
        finalScore: score.scoreBreakdown.finalScore,
        decision: score.scoreBreakdown.decision,
      },
      phases: buildPhaseSummaries(scenarioSnapshot, answers, issues),
      issues: {
        total: issues.length,
        critical: countIssues(issues, 'critical'),
        high: countIssues(issues, 'high'),
        medium: countIssues(issues, 'medium'),
        low: countIssues(issues, 'low'),
        blocking: issues.filter((issue) => issue.is_blocking).length,
        items: issues.map((issue) => ({
          id: issue.id,
          title: issue.title,
          severity: issue.severity,
          category: issue.category,
          status: issue.status,
          isBlocking: issue.is_blocking,
          phaseId: issue.phase_id,
        })),
      },
      attachments: {
        total: attachments.length,
        byTargetType: attachments.reduce<Record<string, number>>((acc, attachment) => {
          acc[attachment.target_type] = (acc[attachment.target_type] ?? 0) + 1;
          return acc;
        }, {}),
      },
      recommendations: buildRecommendations(
        score.scoreBreakdown.finalScore,
        score.blockedChecks,
        issues,
      ),
    };
  }

  async exportRun(runId: string, user: PlatformAdminUser, format: 'json' | 'markdown' = 'json') {
    const report = await this.getRunReport(runId, user);
    if (format === 'markdown') {
      return { contentType: 'text/markdown; charset=utf-8', body: renderQaMarkdownReport(report) };
    }
    return {
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify(report, null, 2),
    };
  }
}

function buildPhaseSummaries(
  snapshot: { phases?: Array<Record<string, unknown>> } | null,
  answers: QaAnswerRecord[],
  issues: QaIssueRecord[],
): QaRunReport['phases'] {
  const phases = Array.isArray(snapshot?.phases) ? snapshot.phases : [];
  const phaseIds = new Set<string | null>([
    ...phases.map((phase) => String(phase.id ?? '') || null),
    ...answers.map((answer) => answer.phase_id),
    ...issues.map((issue) => issue.phase_id),
  ]);
  return Array.from(phaseIds)
    .filter(Boolean)
    .map((phaseId) => {
      const phase = phases.find((item) => item.id === phaseId);
      const phaseAnswers = answers.filter(
        (answer) => answer.phase_id === phaseId && answer.check_id,
      );
      const phaseIssues = issues.filter((issue) => issue.phase_id === phaseId);
      return {
        phaseId,
        phaseKey: typeof phase?.phase_key === 'string' ? phase.phase_key : null,
        title: typeof phase?.title === 'string' ? phase.title : (phaseId ?? 'Unknown phase'),
        totalChecks: phaseAnswers.length,
        passCount: phaseAnswers.filter((answer) => answer.status === 'pass').length,
        failCount: phaseAnswers.filter((answer) => answer.status === 'fail').length,
        blockedCount: phaseAnswers.filter((answer) => answer.status === 'blocked').length,
        naCount: phaseAnswers.filter((answer) => answer.status === 'not_applicable').length,
        averageRating: round2(
          average(phaseAnswers.map((answer) => Number(answer.rating)).filter(Number.isFinite)),
        ),
        mainIssues: phaseIssues.slice(0, 5).map((issue) => ({
          id: issue.id,
          title: issue.title,
          severity: issue.severity,
          category: issue.category,
          isBlocking: issue.is_blocking,
        })),
      };
    });
}

function buildRecommendations(
  finalScore: number,
  blockedChecks: number,
  issues: QaIssueRecord[],
): string[] {
  const recommendations: string[] = [];
  if (issues.some((issue) => issue.severity === 'critical')) {
    recommendations.push('لا يوصى بالإطلاق قبل إغلاق المشكلات الحرجة.');
  }
  if (issues.some((issue) => issue.is_blocking) || blockedChecks > 0) {
    recommendations.push(
      'أعد الاختبار بعد إصلاح العناصر الحاجبة والتأكد من فتح المسارات الأساسية.',
    );
  }
  if (finalScore < 75) {
    recommendations.push('خطط لجولة مراجعة UX/QA مركزة قبل إرسال التجربة لتجار حقيقيين.');
  }
  if (issues.some((issue) => issue.category === 'security' || issue.category === 'integration')) {
    recommendations.push('راجع مشكلات التكامل والأمان مع الفريق التقني قبل اعتماد الجاهزية.');
  }
  if (recommendations.length === 0) {
    recommendations.push(
      'الجولة تبدو مستقرة، ويكفي إغلاق الملاحظات غير الحاجبة قبل الاعتماد النهائي.',
    );
  }
  return recommendations;
}

function readSnapshot(value: Record<string, unknown> | null): {
  scenario?: { title?: string; title_ar?: string | null };
  phases?: Array<Record<string, unknown>>;
} | null {
  if (!value || typeof value !== 'object') return null;
  return value;
}

function countIssues(issues: QaIssueRecord[], severity: string): number {
  return issues.filter((issue) => issue.severity === severity).length;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round2(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { QaRepository } from './qa.repository';
import { calculateQaScore } from './utils/qa-score.util';

@Injectable()
export class QaSummaryService {
  constructor(private readonly qaRepository: QaRepository) {}

  async calculateAndPersist(runId: string) {
    const run = await this.qaRepository.findRunById(runId);
    if (!run) {
      throw new NotFoundException('QA run not found');
    }

    const [answers, issues, totalChecks] = await Promise.all([
      this.qaRepository.listAnswers(runId),
      this.qaRepository.listRunIssues(runId),
      this.qaRepository.countScenarioChecks(run.scenario_id),
    ]);

    const score = calculateQaScore({
      totalChecks,
      final: run.status === 'completed',
      answers: answers
        .filter((answer) => answer.check_id)
        .map((answer) => ({
          phaseId: answer.phase_id,
          status: answer.status,
        })),
      issues: issues.map((issue) => ({
        phaseId: issue.phase_id,
        severity: issue.severity,
        isBlocking: issue.is_blocking,
      })),
    });

    return this.qaRepository.upsertSummary({
      runId,
      totalChecks: score.totalChecks,
      passedChecks: score.passedChecks,
      failedChecks: score.failedChecks,
      blockedChecks: score.blockedChecks,
      notApplicableChecks: score.notApplicableChecks,
      successPercent: score.successPercent,
      readinessStatus: score.readinessStatus,
      issuesCount: score.issuesCount,
      criticalIssuesCount: score.criticalIssuesCount,
      highIssuesCount: score.highIssuesCount,
      mostProblematicPhaseId: score.mostProblematicPhaseId,
      summary: {
        phaseBreakdown: score.phaseBreakdown,
        score: score.scoreBreakdown,
        readinessScore: score.readinessScore,
        readinessDecision: score.readinessDecision,
      },
    });
  }

  async getSummary(runId: string) {
    return this.qaRepository.getSummary(runId);
  }
}

import type { QaAnswerStatus } from '../enums/qa-answer-status.enum';
import type { QaReadinessStatus } from '../enums/qa-readiness-status.enum';

export interface QaScoreInput {
  totalChecks: number;
  final?: boolean;
  answers: Array<{ phaseId: string | null; status: QaAnswerStatus | null }>;
  issues: Array<{ phaseId: string | null; severity: string; isBlocking: boolean }>;
}

export interface QaPhaseBreakdown {
  phaseId: string | null;
  totalChecks: number;
  passed: number;
  failed: number;
  blocked: number;
  notApplicable: number;
  successPercent: number;
  issuesCount: number;
  criticalIssues: number;
  highIssues: number;
}

export interface QaScoreResult {
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  blockedChecks: number;
  notApplicableChecks: number;
  successPercent: number;
  readinessScore: number;
  readinessDecision: string;
  scoreBreakdown: {
    baseScore: number;
    severityPenalty: number;
    blockingPenalty: number;
    issuePenalty: number;
    completionPenalty: number;
    finalScore: number;
    decision: string;
  };
  readinessStatus: QaReadinessStatus;
  issuesCount: number;
  criticalIssuesCount: number;
  highIssuesCount: number;
  mostProblematicPhaseId: string | null;
  phaseBreakdown: QaPhaseBreakdown[];
}

export function calculateQaScore(input: QaScoreInput): QaScoreResult {
  const passedChecks = input.answers.filter((answer) => answer.status === 'pass').length;
  const failedChecks = input.answers.filter((answer) => answer.status === 'fail').length;
  const blockedChecks = input.answers.filter((answer) => answer.status === 'blocked').length;
  const notApplicableChecks = input.answers.filter(
    (answer) => answer.status === 'not_applicable',
  ).length;
  const applicableChecks = Math.max(input.totalChecks - notApplicableChecks, 0);
  const answeredChecks = passedChecks + failedChecks + blockedChecks + notApplicableChecks;
  const applicableAnsweredChecks = Math.max(answeredChecks - notApplicableChecks, 0);
  const successPercent =
    applicableChecks > 0 ? Math.round((passedChecks / applicableChecks) * 10000) / 100 : 0;
  const baseScore =
    applicableAnsweredChecks > 0
      ? Math.round((passedChecks / applicableAnsweredChecks) * 10000) / 100
      : 0;
  const criticalIssuesCount = input.issues.filter((issue) => issue.severity === 'critical').length;
  const highIssuesCount = input.issues.filter((issue) => issue.severity === 'high').length;
  const blockingIssuesCount = input.issues.filter((issue) => issue.isBlocking).length;
  const phaseBreakdown = buildPhaseBreakdown(input);
  const severityPenalty = calculateSeverityPenalty(input.issues);
  const blockingPenalty = Math.min(blockingIssuesCount * 10, 25);
  const completionPenalty = input.final
    ? calculateCompletionPenalty(input.totalChecks, answeredChecks)
    : 0;
  const issuePenalty = Math.round((severityPenalty + blockingPenalty) * 100) / 100;
  const readinessScore = clampScore(baseScore - issuePenalty - completionPenalty);
  const readinessDecision = resolveReadinessDecision(readinessScore);
  const readinessStatus = resolveReadinessStatusFromScore(readinessScore, {
    criticalIssuesCount,
    blockingIssuesCount,
  });

  return {
    totalChecks: input.totalChecks,
    passedChecks,
    failedChecks,
    blockedChecks,
    notApplicableChecks,
    successPercent,
    readinessScore,
    readinessDecision,
    scoreBreakdown: {
      baseScore,
      severityPenalty,
      blockingPenalty,
      issuePenalty,
      completionPenalty,
      finalScore: readinessScore,
      decision: readinessDecision,
    },
    readinessStatus,
    issuesCount: input.issues.length,
    criticalIssuesCount,
    highIssuesCount,
    mostProblematicPhaseId: resolveMostProblematicPhase(phaseBreakdown),
    phaseBreakdown,
  };
}

function resolveReadinessStatusFromScore(
  score: number,
  input: { criticalIssuesCount: number; blockingIssuesCount: number },
): QaReadinessStatus {
  if (input.criticalIssuesCount > 0 || input.blockingIssuesCount > 0 || score < 40) {
    return 'blocked';
  }
  if (score >= 90) {
    return 'ready';
  }
  if (score >= 60) {
    return 'ready_with_fixes';
  }
  return 'not_ready';
}

function resolveReadinessDecision(score: number): string {
  if (score >= 90) return 'Ready';
  if (score >= 75) return 'Ready with minor fixes';
  if (score >= 60) return 'Ready with major fixes';
  if (score >= 40) return 'Not ready';
  return 'Blocked / Critical';
}

function calculateSeverityPenalty(issues: QaScoreInput['issues']): number {
  const critical = Math.min(
    issues.filter((issue) => issue.severity === 'critical').length * 12,
    35,
  );
  const high = Math.min(issues.filter((issue) => issue.severity === 'high').length * 6, 25);
  const medium = Math.min(issues.filter((issue) => issue.severity === 'medium').length * 2, 12);
  const low = Math.min(issues.filter((issue) => issue.severity === 'low').length * 0.5, 5);
  return Math.round((critical + high + medium + low) * 100) / 100;
}

function calculateCompletionPenalty(totalChecks: number, answeredChecks: number): number {
  if (totalChecks <= 0 || answeredChecks >= totalChecks) return 0;
  const unansweredRate = (totalChecks - answeredChecks) / totalChecks;
  return Math.round(Math.min(unansweredRate * 25, 25) * 100) / 100;
}

function clampScore(value: number): number {
  return Math.round(Math.max(0, Math.min(100, value)) * 100) / 100;
}

function buildPhaseBreakdown(input: QaScoreInput): QaPhaseBreakdown[] {
  const phaseIds = new Set<string | null>();
  input.answers.forEach((answer) => phaseIds.add(answer.phaseId));
  input.issues.forEach((issue) => phaseIds.add(issue.phaseId));

  return Array.from(phaseIds).map((phaseId) => {
    const answers = input.answers.filter((answer) => answer.phaseId === phaseId);
    const issues = input.issues.filter((issue) => issue.phaseId === phaseId);
    const notApplicable = answers.filter((answer) => answer.status === 'not_applicable').length;
    const passed = answers.filter((answer) => answer.status === 'pass').length;
    const applicable = Math.max(answers.length - notApplicable, 0);
    return {
      phaseId,
      totalChecks: answers.length,
      passed,
      failed: answers.filter((answer) => answer.status === 'fail').length,
      blocked: answers.filter((answer) => answer.status === 'blocked').length,
      notApplicable,
      successPercent: applicable > 0 ? Math.round((passed / applicable) * 10000) / 100 : 0,
      issuesCount: issues.length,
      criticalIssues: issues.filter((issue) => issue.severity === 'critical').length,
      highIssues: issues.filter((issue) => issue.severity === 'high').length,
    };
  });
}

function resolveMostProblematicPhase(phases: QaPhaseBreakdown[]): string | null {
  const sorted = [...phases].sort((left, right) => {
    if (right.blocked !== left.blocked) return right.blocked - left.blocked;
    if (right.failed !== left.failed) return right.failed - left.failed;
    const rightSerious = right.criticalIssues + right.highIssues;
    const leftSerious = left.criticalIssues + left.highIssues;
    if (rightSerious !== leftSerious) return rightSerious - leftSerious;
    return left.successPercent - right.successPercent;
  });
  return sorted[0]?.phaseId ?? null;
}

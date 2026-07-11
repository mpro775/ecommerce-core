import type { QaReadinessStatus } from '../enums/qa-readiness-status.enum';

export interface QaRunSummaryRecord {
  id: string;
  run_id: string;
  total_checks: number;
  passed_checks: number;
  failed_checks: number;
  blocked_checks: number;
  not_applicable_checks: number;
  success_percent: string | null;
  readiness_status: QaReadinessStatus;
  issues_count: number;
  critical_issues_count: number;
  high_issues_count: number;
  most_problematic_phase_id: string | null;
  summary: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

import type { QaIssueCategory } from '../enums/qa-issue-category.enum';
import type { QaIssueSeverity } from '../enums/qa-issue-severity.enum';

export interface QaIssueRecord {
  id: string;
  run_id: string;
  scenario_id: string;
  phase_id: string | null;
  check_id: string | null;
  question_id: string | null;
  title: string;
  description: string | null;
  steps_to_reproduce: string | null;
  expected_result: string | null;
  actual_result: string | null;
  severity: QaIssueSeverity;
  category: QaIssueCategory;
  status: 'open' | 'triaged' | 'fixed' | 'wont_fix' | 'verified';
  is_blocking: boolean;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

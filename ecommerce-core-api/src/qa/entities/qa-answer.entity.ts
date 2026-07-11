import type { QaAnswerStatus } from '../enums/qa-answer-status.enum';

export interface QaAnswerRecord {
  id: string;
  run_id: string;
  scenario_id: string;
  phase_id: string | null;
  check_id: string | null;
  question_id: string | null;
  answer_target_key: string;
  status: QaAnswerStatus | null;
  value: Record<string, unknown> | null;
  note: string | null;
  rating: string | null;
  answered_by: string | null;
  answered_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface QaQuestionRecord {
  id: string;
  scenario_id: string;
  phase_id: string;
  question_key: string;
  order_index: number;
  text: string;
  type: string;
  required: boolean;
  options: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

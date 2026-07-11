export interface QaCheckRecord {
  id: string;
  scenario_id: string;
  phase_id: string;
  check_key: string;
  order_index: number;
  text: string;
  type: string;
  required: boolean;
  weight: string | null;
  expected_result: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

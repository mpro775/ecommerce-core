export interface QaPhaseRecord {
  id: string;
  scenario_id: string;
  phase_key: string;
  order_index: number;
  title: string;
  description: string | null;
  goal: string | null;
  instructions: Array<Record<string, unknown>>;
  expected_result: string | null;
  weight: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

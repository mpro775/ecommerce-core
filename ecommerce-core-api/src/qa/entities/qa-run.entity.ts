import type { QaRunStatus } from '../enums/qa-run-status.enum';

export interface QaRunRecord {
  id: string;
  scenario_id: string;
  scenario_key: string;
  scenario_version: string;
  scenario_checksum: string;
  scenario_snapshot: Record<string, unknown> | null;
  tester_id: string | null;
  tester_name: string | null;
  status: QaRunStatus;
  current_phase_id: string | null;
  current_phase_key: string | null;
  current_check_id: string | null;
  current_check_key: string | null;
  progress_percent: string;
  environment: string | null;
  device_type: string | null;
  browser: string | null;
  os: string | null;
  screen_size: string | null;
  build_version: string | null;
  test_round: string | null;
  notes: string | null;
  started_at: Date | null;
  last_saved_at: Date | null;
  completed_at: Date | null;
  locked_at: Date | null;
  locked_by: string | null;
  created_at: Date;
  updated_at: Date;
}

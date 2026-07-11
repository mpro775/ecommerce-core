export interface QaScenarioRecord {
  id: string;
  scenario_key: string;
  title: string;
  title_ar: string | null;
  description: string | null;
  version: string;
  checksum: string;
  is_active: boolean;
  source_file: string | null;
  metadata: Record<string, unknown>;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

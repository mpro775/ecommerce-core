import type { QaAttachmentTarget } from '../enums/qa-attachment-target.enum';

export interface QaAttachmentRecord {
  id: string;
  run_id: string;
  scenario_id: string;
  issue_id: string | null;
  phase_id: string | null;
  check_id: string | null;
  question_id: string | null;
  target_type: QaAttachmentTarget;
  bucket_name: string;
  object_key: string;
  mime_type: string;
  file_size_bytes: string;
  etag: string | null;
  file_name: string | null;
  uploaded_by: string | null;
  confirmed_at: Date | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

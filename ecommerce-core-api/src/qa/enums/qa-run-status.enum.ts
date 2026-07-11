export const QA_RUN_STATUSES = [
  'draft',
  'in_progress',
  'paused',
  'completed',
  'blocked',
  'cancelled',
] as const;
export type QaRunStatus = (typeof QA_RUN_STATUSES)[number];

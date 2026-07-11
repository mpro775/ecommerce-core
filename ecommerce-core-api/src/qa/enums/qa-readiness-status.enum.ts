export const QA_READINESS_STATUSES = ['ready', 'ready_with_fixes', 'not_ready', 'blocked'] as const;
export type QaReadinessStatus = (typeof QA_READINESS_STATUSES)[number];

export const QA_ISSUE_CATEGORIES = [
  'functional',
  'ux',
  'content',
  'performance',
  'accessibility',
  'security',
  'data',
  'integration',
  'other',
] as const;
export type QaIssueCategory = (typeof QA_ISSUE_CATEGORIES)[number];

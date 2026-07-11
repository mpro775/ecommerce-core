export const QA_ISSUE_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export type QaIssueSeverity = (typeof QA_ISSUE_SEVERITIES)[number];

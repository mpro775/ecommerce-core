export const QA_ANSWER_STATUSES = ['pass', 'fail', 'blocked', 'not_applicable'] as const;
export type QaAnswerStatus = (typeof QA_ANSWER_STATUSES)[number];

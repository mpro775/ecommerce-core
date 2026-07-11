export const QA_ATTACHMENT_TARGETS = ['run', 'phase', 'check', 'question', 'issue'] as const;
export type QaAttachmentTarget = (typeof QA_ATTACHMENT_TARGETS)[number];

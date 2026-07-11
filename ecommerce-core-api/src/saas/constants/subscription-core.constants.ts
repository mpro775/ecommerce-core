export const SUBSCRIPTION_STATUSES = [
  'trialing',
  'active',
  'past_due',
  'suspended',
  'canceled',
  'expired',
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const SUBSCRIPTION_INVOICE_STATUSES = [
  'draft',
  'open',
  'paid',
  'failed',
  'void',
  'refunded',
] as const;

export type SubscriptionInvoiceStatus = (typeof SUBSCRIPTION_INVOICE_STATUSES)[number];

export const SUBSCRIPTION_PAYMENT_STATUSES = [
  'pending',
  'succeeded',
  'failed',
  'refunded',
] as const;

export type SubscriptionPaymentStatus = (typeof SUBSCRIPTION_PAYMENT_STATUSES)[number];

export const SUBSCRIPTION_BILLING_CYCLES = ['monthly', 'annual', 'manual'] as const;

export type SubscriptionBillingCycle = (typeof SUBSCRIPTION_BILLING_CYCLES)[number];

export const INVOICE_BILLING_CYCLES = ['monthly', 'annual', 'proration', 'manual'] as const;

export type InvoiceBillingCycle = (typeof INVOICE_BILLING_CYCLES)[number];

export const SUBSCRIPTION_ADJUSTMENT_OPERATIONS = [
  'extend_period',
  'reduce_period',
  'set_period_end',
  'set_next_billing_at',
  'grant_trial_days',
  'clear_trial',
  'set_status',
  'suspend',
  'resume',
  'cancel',
  'reset_billing_cycle',
  'mark_paid_until',
  'manual_correction',
  'compensation',
  'marketing_gift',
] as const;

export type SubscriptionAdjustmentOperation = (typeof SUBSCRIPTION_ADJUSTMENT_OPERATIONS)[number];

export const SUBSCRIPTION_ACCOUNTING_CATEGORIES = [
  'revenue',
  'marketing_gift',
  'trial',
  'coupon_discount',
  'compensation',
  'manual_adjustment',
  'internal_test',
] as const;

export type SubscriptionAccountingCategory = (typeof SUBSCRIPTION_ACCOUNTING_CATEGORIES)[number];

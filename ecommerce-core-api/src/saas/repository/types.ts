import type { LimitResetPeriod, SaasFeatureKey } from '../constants/saas-metrics.constants';
import type {
  InvoiceBillingCycle,
  SubscriptionBillingCycle,
  SubscriptionInvoiceStatus,
  SubscriptionPaymentStatus,
  SubscriptionStatus,
  SubscriptionAccountingCategory,
  SubscriptionAdjustmentOperation,
} from '../constants/subscription-core.constants';

export interface Queryable {
  query: <T = unknown>(
    queryText: string,
    values?: unknown[],
  ) => Promise<{ rows: T[]; rowCount: number | null }>;
}

export interface PlanRecord {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  monthly_price: string | null;
  annual_price: string | null;
  monthly_compare_at_price: string | null;
  annual_compare_at_price: string | null;
  currency_code: string;
  billing_cycle_options: string[];
  trial_days_default: number;
  sale_label: string | null;
  sale_starts_at: Date | null;
  sale_ends_at: Date | null;
  is_intro_offer: boolean;
  is_sale_active: boolean;
  metadata: Record<string, unknown>;
}

export type AfterTrialBehavior =
  | 'downgrade_to_free'
  | 'mark_past_due'
  | 'suspend_paid_features'
  | 'create_invoice';

export interface SubscriptionSettingsRecord {
  id: string;
  signup_trial_enabled: boolean;
  signup_trial_plan_code: string | null;
  signup_trial_days: number;
  after_trial_behavior: AfterTrialBehavior;
  free_plan_code: string | null;
  allow_trial_plan_change: boolean;
  one_trial_per_store: boolean;
  one_trial_per_owner: boolean;
  trial_requires_payment_method: boolean;
  trial_reminder_days_before: number[];
  created_at: Date;
  updated_at: Date;
}

export type SubscriptionCouponDiscountType =
  | 'percent'
  | 'fixed'
  | 'free_days'
  | 'free_months'
  | 'activate_plan';

export interface SubscriptionCouponRecord {
  id: string;
  code: string;
  name: string;
  description: string | null;
  discount_type: SubscriptionCouponDiscountType;
  discount_value: string;
  currency_code: string;
  duration_months: number;
  applies_to_plan_codes: string[];
  purpose: 'discount' | 'activation' | 'retention' | 'compensation' | 'trial';
  accounting_category: SubscriptionAccountingCategory;
  affects_revenue: boolean;
  activate_plan_code: string | null;
  max_redemptions: number | null;
  max_redemptions_per_store: number | null;
  redeemed_count: number;
  starts_at: Date | null;
  expires_at: Date | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface SubscriptionCouponRedemptionRecord {
  id: string;
  coupon_id: string;
  store_id: string;
  subscription_id: string | null;
  plan_id: string | null;
  invoice_id: string | null;
  coupon_code: string;
  discount_type: SubscriptionCouponDiscountType;
  discount_value: string;
  billing_cycle: string;
  original_amount: string;
  discount_amount: string;
  final_amount: string;
  free_months: number;
  metadata: Record<string, unknown>;
  redeemed_at: Date;
}

export type SubscriptionPaymentReceiptStatus =
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'canceled';

export interface SubscriptionPaymentReceiptRecord {
  id: string;
  store_id: string;
  subscription_id: string | null;
  invoice_id: string;
  payment_id: string | null;
  status: SubscriptionPaymentReceiptStatus;
  payment_method_id: string | null;
  payment_method_code: string | null;
  payment_method_name: string | null;
  amount: string;
  currency_code: string;
  transaction_reference: string | null;
  paid_at: Date | null;
  receipt_media_id: string | null;
  receipt_url: string | null;
  receipt_file_name: string | null;
  receipt_mime_type: string | null;
  receipt_size_bytes: string | null;
  merchant_note: string | null;
  admin_note: string | null;
  rejection_reason: string | null;
  reviewed_by_admin_id: string | null;
  reviewed_at: Date | null;
  created_by_user_id: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  metadata: Record<string, unknown>;
  store_name?: string | null;
  store_slug?: string | null;
  invoice_number?: string | null;
  invoice_status?: string | null;
}

export interface PlanLimitRecord {
  id: string;
  plan_id: string;
  metric_key: string;
  metric_limit: number | null;
  reset_period: LimitResetPeriod;
}

export interface PlanEntitlementRecord {
  id: string;
  plan_id: string;
  feature_key: SaasFeatureKey;
  is_enabled: boolean;
}

export interface CurrentSubscriptionRecord {
  id: string;
  store_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  starts_at: Date;
  current_period_end: Date | null;
  trial_ends_at: Date | null;
  billing_cycle: SubscriptionBillingCycle;
  cancel_at_period_end: boolean;
  canceled_at: Date | null;
  next_billing_at: Date | null;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  plan_code: string;
  plan_name: string;
  plan_description: string | null;
  plan_is_active: boolean;
  plan_monthly_price: string | null;
  plan_annual_price: string | null;
  plan_monthly_compare_at_price: string | null;
  plan_annual_compare_at_price: string | null;
  plan_currency_code: string;
  plan_sale_label: string | null;
  plan_sale_starts_at: Date | null;
  plan_sale_ends_at: Date | null;
  plan_is_intro_offer: boolean;
  plan_is_sale_active: boolean;
}

export interface PlatformStoreRecord {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended' | 'deleted';
  is_suspended: boolean;
  suspension_reason: string | null;
  deleted_at: Date | null;
  deleted_by_platform_admin_id: string | null;
  deletion_reason: string | null;
  purge_status: 'not_started' | 'pending' | 'processing' | 'completed' | 'failed';
  purge_started_at: Date | null;
  purge_completed_at: Date | null;
  purge_error: string | null;
  created_at: Date;
  plan_code: string | null;
  subscription_status: string | null;
  total_domains: number;
  active_domains: number;
}

export interface StoreDeletionPreviewRecord {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended' | 'deleted';
  is_suspended: boolean;
  deleted_at: Date | null;
  deletion_reason: string | null;
  purge_status: 'not_started' | 'pending' | 'processing' | 'completed' | 'failed';
  owner_user_id: string | null;
  owner_email: string | null;
  orders_count: number;
  products_count: number;
  domains_count: number;
  has_active_subscription: boolean;
  has_open_disputes: boolean;
  has_pending_payments: boolean;
}

export interface PlatformSubscriptionRecord {
  id: string;
  store_id: string;
  store_name: string;
  store_slug: string;
  plan_code: string;
  plan_name: string;
  status: string;
  starts_at: Date;
  current_period_end: Date | null;
  trial_ends_at: Date | null;
  billing_cycle: SubscriptionBillingCycle;
  next_billing_at: Date | null;
  cancel_at_period_end: boolean;
}

export interface PlatformDomainRecord {
  id: string;
  store_id: string;
  store_name: string;
  hostname: string;
  status: string;
  ssl_status: string;
  ssl_provider?: string;
  ssl_mode?: string;
  ssl_last_checked_at?: Date | null;
  ssl_error?: string | null;
  cloudflare_zone_id?: string | null;
  cloudflare_hostname_id?: string | null;
  last_dns_check_at?: Date | null;
  last_dns_check_result?: Record<string, unknown>[] | null;
  support_required?: boolean;
  technical_error_code?: string | null;
  technical_error_message?: string | null;
  verification_token?: string;
  verified_at?: Date | null;
  activated_at?: Date | null;
  updated_at: Date;
}

export interface PlatformDashboardSummaryRecord {
  total_stores: string;
  active_stores: string;
  suspended_stores: string;
  total_subscriptions: string;
  active_subscriptions: string;
  trialing_subscriptions: string;
  past_due_subscriptions: string;
  canceled_subscriptions: string;
  total_domains: string;
  domain_issues: string;
}

export interface PlatformAuditActivityRecord {
  id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  store_id: string | null;
}

export interface PlatformStoreNoteRecord {
  id: string;
  store_id: string;
  author_admin_id: string | null;
  author_name: string | null;
  type: string;
  body: string;
  pinned: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface PlatformIncidentRecord {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  service: string;
  title: string;
  summary: string;
  status: 'open' | 'investigating' | 'mitigated' | 'resolved';
  related_store_id: string | null;
  created_by_admin_id: string | null;
  created_by_name: string | null;
  created_at: Date;
  resolved_at: Date | null;
  updated_at: Date;
}

export interface PlatformAdminUserRecord {
  id: string;
  full_name: string;
  email: string;
  status: 'active' | 'disabled';
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface PlatformRoleRecord {
  id: string;
  name: string;
  code: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface PlatformSettingRecord {
  id: string;
  key: string;
  value: Record<string, unknown>;
  updated_by: string | null;
  updated_by_name: string | null;
  updated_at: Date;
}

export interface PlatformAutomationRuleRecord {
  id: string;
  name: string;
  description: string | null;
  trigger_type: 'manual' | 'schedule' | 'event';
  trigger_config: Record<string, unknown>;
  action_type: string;
  action_config: Record<string, unknown>;
  is_active: boolean;
  last_run_at: Date | null;
  created_by_admin_id: string | null;
  updated_by_admin_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface PlatformAutomationRunRecord {
  id: string;
  rule_id: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';
  triggered_by_admin_id: string | null;
  store_id: string | null;
  started_at: Date | null;
  finished_at: Date | null;
  logs: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
}

export interface PlatformSupportCaseRecord {
  id: string;
  store_id: string | null;
  subject: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'escalated' | 'resolved' | 'closed';
  queue: string;
  assignee_admin_id: string | null;
  assignee_name: string | null;
  sla_due_at: Date | null;
  impact_score: number;
  created_by_admin_id: string | null;
  created_by_name: string | null;
  resolved_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface PlatformSupportCaseEventRecord {
  id: string;
  case_id: string;
  event_type: string;
  actor_admin_id: string | null;
  actor_name: string | null;
  payload: Record<string, unknown>;
  created_at: Date;
}

export interface PlatformRiskViolationRecord {
  id: string;
  store_id: string | null;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  score: number;
  status: 'open' | 'investigating' | 'mitigated' | 'accepted' | 'resolved';
  summary: string;
  details: Record<string, unknown>;
  detected_at: Date;
  resolved_at: Date | null;
  owner_admin_id: string | null;
  owner_name: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface PlatformComplianceTaskRecord {
  id: string;
  violation_id: string | null;
  policy_key: string;
  title: string;
  status: 'pending' | 'in_progress' | 'done' | 'skipped';
  due_at: Date | null;
  assignee_admin_id: string | null;
  assignee_name: string | null;
  checklist: Record<string, unknown>[];
  evidence: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface SubscriptionInvoiceRecord {
  id: string;
  store_id: string;
  subscription_id: string;
  plan_id: string;
  invoice_number: string;
  billing_cycle: InvoiceBillingCycle;
  period_start: Date;
  period_end: Date;
  subtotal_amount: string;
  tax_amount: string;
  total_amount: string;
  currency_code: string;
  status: SubscriptionInvoiceStatus;
  due_at: Date | null;
  paid_at: Date | null;
  external_invoice_id: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  original_amount: string | null;
  discount_amount: string;
  coupon_code: string | null;
}

export interface SubscriptionPaymentRecord {
  id: string;
  invoice_id: string;
  store_id: string;
  provider: string;
  payment_method: string | null;
  status: SubscriptionPaymentStatus;
  amount: string;
  currency_code: string;
  external_transaction_id: string | null;
  failure_reason: string | null;
  processed_at: Date | null;
  metadata: Record<string, unknown>;
  created_at: Date;
}

export interface PlatformInvoiceDetailsRecord extends SubscriptionInvoiceRecord {
  store_name: string;
  store_slug: string;
  plan_code: string | null;
  plan_name: string | null;
  subscription_status: string | null;
}

export interface BillingEventRecord {
  id: string;
  store_id: string | null;
  source: 'provider_webhook' | 'internal_admin' | 'merchant_action' | 'system_scheduler';
  event_type: string;
  idempotency_key: string | null;
  payload: Record<string, unknown>;
  status: 'received' | 'processed' | 'failed' | 'ignored';
  processing_error: string | null;
  processed_at: Date | null;
  created_at: Date;
}

export interface SubscriptionAdjustmentRecord {
  id: string;
  store_id: string;
  subscription_id: string;
  invoice_id: string | null;
  operation: SubscriptionAdjustmentOperation;
  accounting_category: SubscriptionAccountingCategory;
  affects_revenue: boolean;
  amount: string | null;
  currency_code: string | null;
  days_delta: number | null;
  old_status: string | null;
  new_status: string | null;
  old_billing_cycle: string | null;
  new_billing_cycle: string | null;
  old_current_period_end: Date | null;
  new_current_period_end: Date | null;
  old_next_billing_at: Date | null;
  new_next_billing_at: Date | null;
  old_trial_ends_at: Date | null;
  new_trial_ends_at: Date | null;
  reason: string;
  note: string | null;
  created_by_admin_id: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
}

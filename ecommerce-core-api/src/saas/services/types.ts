import type {
  LimitResetPeriod,
  SaasFeatureKey,
  SaasMetricKey,
} from '../constants/saas-metrics.constants';
import type {
  InvoiceBillingCycle,
  SubscriptionBillingCycle,
  SubscriptionInvoiceStatus,
  SubscriptionStatus,
  SubscriptionAccountingCategory,
  SubscriptionAdjustmentOperation,
} from '../constants/subscription-core.constants';

export interface LimitResponse {
  metricKey: string;
  metricLimit: number | null;
  resetPeriod: LimitResetPeriod;
}

export interface EntitlementResponse {
  featureKey: SaasFeatureKey;
  isEnabled: boolean;
}

export interface CapabilityCatalogResponse {
  metrics: Array<{
    key: SaasMetricKey;
    displayName: string;
    description: string;
    resetPeriods: LimitResetPeriod[];
    enforcedIn: string[];
  }>;
  features: Array<{
    key: SaasFeatureKey;
    displayName: string;
    description: string;
    enforcedIn: string[];
  }>;
}

export interface InvoiceResponse {
  id: string;
  invoiceNumber: string;
  billingCycle: InvoiceBillingCycle;
  subtotalAmount: number;
  originalAmount: number | null;
  discountAmount: number;
  couponCode: string | null;
  taxAmount: number;
  totalAmount: number;
  currencyCode: string;
  status: SubscriptionInvoiceStatus;
  dueAt: Date | null;
  paidAt: Date | null;
  periodStart: Date;
  periodEnd: Date;
  createdAt: Date;
}

export interface PlanResponse {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  monthlyPrice: number | null;
  annualPrice: number | null;
  monthlyCompareAtPrice: number | null;
  annualCompareAtPrice: number | null;
  currencyCode: string;
  billingCycleOptions: string[];
  trialDaysDefault: number;
  saleLabel: string | null;
  saleStartsAt: Date | null;
  saleEndsAt: Date | null;
  isIntroOffer: boolean;
  isSaleActive: boolean;
  isSaleVisible: boolean;
  limits: LimitResponse[];
  entitlements: EntitlementResponse[];
}

export interface StoreSubscriptionResponse {
  id: string;
  storeId: string;
  status: SubscriptionStatus;
  startsAt: Date;
  currentPeriodEnd: Date | null;
  trialEndsAt: Date | null;
  billingCycle: SubscriptionBillingCycle;
  nextBillingAt: Date | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
  plan: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    isActive: boolean;
    monthlyPrice: number | null;
    annualPrice: number | null;
    monthlyCompareAtPrice: number | null;
    annualCompareAtPrice: number | null;
    currencyCode: string;
    saleLabel: string | null;
    saleStartsAt: Date | null;
    saleEndsAt: Date | null;
    isIntroOffer: boolean;
    isSaleActive: boolean;
    isSaleVisible: boolean;
  };
  limits: LimitResponse[];
  entitlements: EntitlementResponse[];
  usage: Array<{
    metricKey: string;
    used: number;
    limit: number | null;
    resetPeriod: LimitResetPeriod;
  }>;
}

export interface SubscriptionAdjustmentResponse {
  id: string;
  storeId: string;
  subscriptionId: string;
  invoiceId: string | null;
  operation: SubscriptionAdjustmentOperation;
  accountingCategory: SubscriptionAccountingCategory;
  affectsRevenue: boolean;
  amount: number | null;
  currencyCode: string | null;
  daysDelta: number | null;
  oldStatus: string | null;
  newStatus: string | null;
  oldBillingCycle: string | null;
  newBillingCycle: string | null;
  oldCurrentPeriodEnd: Date | null;
  newCurrentPeriodEnd: Date | null;
  oldNextBillingAt: Date | null;
  newNextBillingAt: Date | null;
  oldTrialEndsAt: Date | null;
  newTrialEndsAt: Date | null;
  reason: string;
  note: string | null;
  createdByAdminId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

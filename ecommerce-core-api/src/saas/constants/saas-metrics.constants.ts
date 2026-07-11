export const SAAS_METRICS = [
  'products.total',
  'orders.monthly',
  'staff.total',
  'domains.total',
  'storage.used',
  'api_calls.monthly',
  'webhooks.monthly',
] as const;

export const LIMIT_RESET_PERIODS = ['lifetime', 'monthly'] as const;

export type SaasMetricKey = (typeof SAAS_METRICS)[number];
export type LimitResetPeriod = (typeof LIMIT_RESET_PERIODS)[number];

export const SAAS_FEATURES = [
  'custom_domains',
  'advanced_promotions',
  'priority_support',
  'advanced_analytics',
  'api_access',
  'webhooks_access',
  'staff_management',
  'affiliate_program',
  'loyalty_program',
] as const;

export type SaasFeatureKey = (typeof SAAS_FEATURES)[number];

export const METRIC_DISPLAY_NAMES: Record<SaasMetricKey, string> = {
  'products.total': 'Products',
  'orders.monthly': 'Monthly Orders',
  'staff.total': 'Staff Members',
  'domains.total': 'Custom Domains',
  'storage.used': 'Storage (MB)',
  'api_calls.monthly': 'Monthly API Calls',
  'webhooks.monthly': 'Monthly Webhooks',
};

export const METRIC_DESCRIPTIONS: Record<SaasMetricKey, string> = {
  'products.total': 'Total active catalog products the store can manage.',
  'orders.monthly': 'Storefront checkout orders accepted during the current month.',
  'staff.total': 'Total staff users that can access the merchant admin.',
  'domains.total': 'Custom domains configured for the store.',
  'storage.used': 'Media storage consumed by uploaded assets, measured in MB.',
  'api_calls.monthly': 'Authenticated API requests counted during the current month.',
  'webhooks.monthly': 'Webhook delivery fan-out attempts during the current month.',
};

export const METRIC_ENFORCEMENT_AREAS: Record<SaasMetricKey, string[]> = {
  'products.total': ['Product creation'],
  'orders.monthly': ['Storefront checkout'],
  'staff.total': ['Staff invite acceptance'],
  'domains.total': ['Custom domain creation'],
  'storage.used': ['Media uploads'],
  'api_calls.monthly': ['Merchant API traffic'],
  'webhooks.monthly': ['Webhook dispatch'],
};

export const FEATURE_DISPLAY_NAMES: Record<SaasFeatureKey, string> = {
  custom_domains: 'Custom Domains',
  advanced_promotions: 'Advanced Promotions',
  priority_support: 'Priority Support',
  advanced_analytics: 'Advanced Analytics',
  api_access: 'API Access',
  webhooks_access: 'Webhooks Access',
  staff_management: 'Staff Management',
  affiliate_program: 'Affiliate Program',
  loyalty_program: 'Loyalty Program',
};

export const FEATURE_DESCRIPTIONS: Record<SaasFeatureKey, string> = {
  custom_domains: 'Allows stores to add and manage custom storefront domains.',
  advanced_promotions: 'Allows access to advanced offer and promotion workflows.',
  priority_support: 'Marks the store as eligible for priority support handling.',
  advanced_analytics: 'Allows access to advanced analytics dashboards and exports.',
  api_access: 'Allows authenticated API access beyond billing and support flows.',
  webhooks_access: 'Allows webhook event delivery to merchant endpoints.',
  staff_management: 'Allows inviting and managing additional staff users.',
  affiliate_program: 'Allows affiliate profiles, links, commissions, and payouts.',
  loyalty_program: 'Allows loyalty points, rules, wallets, and adjustments.',
};

export const FEATURE_ENFORCEMENT_AREAS: Record<SaasFeatureKey, string[]> = {
  custom_domains: ['Domain management'],
  advanced_promotions: ['Advanced offers'],
  priority_support: ['Support triage'],
  advanced_analytics: ['Analytics dashboards', 'Analytics exports'],
  api_access: ['Merchant API traffic'],
  webhooks_access: ['Webhook dispatch'],
  staff_management: ['Staff management'],
  affiliate_program: ['Affiliate management', 'Checkout attribution'],
  loyalty_program: ['Loyalty management', 'Checkout points'],
};

export const DEFAULT_PLAN_LIMITS: Record<
  string,
  Record<SaasMetricKey, { limit: number | null; resetPeriod: LimitResetPeriod }>
> = {
  free: {
    'products.total': { limit: 100, resetPeriod: 'lifetime' },
    'orders.monthly': { limit: 100, resetPeriod: 'monthly' },
    'staff.total': { limit: 1, resetPeriod: 'lifetime' },
    'domains.total': { limit: 1, resetPeriod: 'lifetime' },
    'storage.used': { limit: 500, resetPeriod: 'lifetime' },
    'api_calls.monthly': { limit: 10000, resetPeriod: 'monthly' },
    'webhooks.monthly': { limit: 1000, resetPeriod: 'monthly' },
  },
  pro: {
    'products.total': { limit: 1000, resetPeriod: 'lifetime' },
    'orders.monthly': { limit: 2000, resetPeriod: 'monthly' },
    'staff.total': { limit: 5, resetPeriod: 'lifetime' },
    'domains.total': { limit: 3, resetPeriod: 'lifetime' },
    'storage.used': { limit: 5000, resetPeriod: 'lifetime' },
    'api_calls.monthly': { limit: 100000, resetPeriod: 'monthly' },
    'webhooks.monthly': { limit: 10000, resetPeriod: 'monthly' },
  },
  business: {
    'products.total': { limit: null, resetPeriod: 'lifetime' },
    'orders.monthly': { limit: null, resetPeriod: 'monthly' },
    'staff.total': { limit: 50, resetPeriod: 'lifetime' },
    'domains.total': { limit: 10, resetPeriod: 'lifetime' },
    'storage.used': { limit: 50000, resetPeriod: 'lifetime' },
    'api_calls.monthly': { limit: null, resetPeriod: 'monthly' },
    'webhooks.monthly': { limit: null, resetPeriod: 'monthly' },
  },
};

export const DEFAULT_PLAN_ENTITLEMENTS: Record<string, Record<SaasFeatureKey, boolean>> = {
  free: {
    custom_domains: true,
    advanced_promotions: false,
    priority_support: false,
    advanced_analytics: false,
    api_access: true,
    webhooks_access: true,
    staff_management: true,
    affiliate_program: false,
    loyalty_program: false,
  },
  pro: {
    custom_domains: true,
    advanced_promotions: true,
    priority_support: false,
    advanced_analytics: true,
    api_access: true,
    webhooks_access: true,
    staff_management: true,
    affiliate_program: true,
    loyalty_program: true,
  },
  business: {
    custom_domains: true,
    advanced_promotions: true,
    priority_support: true,
    advanced_analytics: true,
    api_access: true,
    webhooks_access: true,
    staff_management: true,
    affiliate_program: true,
    loyalty_program: true,
  },
};

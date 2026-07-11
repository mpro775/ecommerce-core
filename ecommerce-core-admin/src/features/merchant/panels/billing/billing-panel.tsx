import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  type ChipProps,
} from '@mui/material';
import { CloudUploadIcon } from '../../../../components/icons';
import type { MerchantRequester } from '../../merchant-dashboard.types';
import { AppPage, DataTableWrapper, PageHeader, SectionCard } from '../../components/ui';
import type {
  BillingInvoicesPage,
  BillingReceiptsPage,
  BillingPlanView,
  StoreSubscriptionView,
  SubscriptionBillingCycle,
  SubscriptionInvoiceView,
  SubscriptionReceiptView,
} from '../../types';

interface BillingPanelProps {
  request: MerchantRequester;
}

interface MerchantBillingCenterResponse {
  subscription: {
    planCode: string;
    planName: string;
    status: StoreSubscriptionView['status'];
    billingCycle: SubscriptionBillingCycle;
    currentPeriodEnd: string | null;
    nextBillingAt: string | null;
    daysRemaining: number;
    renewalAmount: number;
    currencyCode: string;
  } | null;
  openInvoice: SubscriptionInvoiceView | null;
  invoices: SubscriptionInvoiceView[];
  receipts: SubscriptionReceiptView[];
  availablePlans: BillingPlanView[];
  canChangePlan: boolean;
  messages: Array<{ type: 'info' | 'warning' | 'danger' | 'success'; code: string; title: string; description: string }>;
}

interface PresignedMediaUpload {
  objectKey: string;
  uploadUrl: string;
  uploadHeaders: Record<string, string>;
}

interface MediaAsset {
  id: string;
  url: string;
  mimeType: string;
  fileSizeBytes: number;
}

const subscriptionStatusLabels: Record<string, string> = {
  trialing: 'تجربة مجانية',
  active: 'نشط',
  past_due: 'متأخر الدفع',
  suspended: 'معلق',
  expired: 'منتهي',
  canceled: 'ملغي',
};

const invoiceStatusColors: Record<SubscriptionInvoiceView['status'], ChipProps['color']> = {
  draft: 'default',
  open: 'info',
  paid: 'success',
  failed: 'error',
  void: 'default',
};

const invoiceStatusLabels: Record<SubscriptionInvoiceView['status'], string> = {
  draft: 'مسودة',
  open: 'مفتوحة',
  paid: 'مدفوعة',
  failed: 'فشلت',
  void: 'ملغاة',
};

const receiptStatusLabels: Record<SubscriptionReceiptView['status'], string> = {
  pending_review: 'قيد المراجعة',
  approved: 'مقبول',
  rejected: 'مرفوض',
  canceled: 'ملغي',
};

const metricLabels: Record<string, string> = {
  'products.total': 'المنتجات',
  'orders.monthly': 'الطلبات الشهرية',
  'staff.total': 'أعضاء الفريق',
  'domains.total': 'النطاقات المخصصة',
  'storage.used': 'التخزين (MB)',
  'api_calls.monthly': 'طلبات API الشهرية',
  'webhooks.monthly': 'Webhooks الشهرية',
};

const featureLabels: Record<string, string> = {
  custom_domains: 'نطاقات مخصصة',
  advanced_promotions: 'عروض متقدمة',
  priority_support: 'دعم ذو أولوية',
  advanced_analytics: 'تحليلات متقدمة',
  api_access: 'وصول API',
  webhooks_access: 'Webhooks',
  staff_management: 'إدارة الفريق',
  affiliate_program: 'برنامج الإحالة',
  loyalty_program: 'برنامج الولاء',
};

const billingCycleLabels: Record<string, string> = {
  monthly: 'شهري',
  annual: 'سنوي',
  manual: 'يدوي',
  proration: 'تعديل الفترة',
};

function formatAmount(amount: number, _currencyCode: string): string {
  return new Intl.NumberFormat('ar-YE', {
    style: 'currency',
    currency: 'YER',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(value: string | null): string {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleDateString('ar-YE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString('ar-YE');
}

function resolvePlanPrice(plan: BillingPlanView, cycle: SubscriptionBillingCycle): number | null {
  if (cycle === 'annual') {
    return plan.annualPrice;
  }
  if (cycle === 'monthly') {
    return plan.monthlyPrice;
  }
  return null;
}

function resolvePlanCompareAtPrice(plan: BillingPlanView, cycle: SubscriptionBillingCycle): number | null {
  if (!plan.isSaleVisible) {
    return null;
  }
  if (cycle === 'annual') {
    return plan.annualCompareAtPrice;
  }
  if (cycle === 'monthly') {
    return plan.monthlyCompareAtPrice;
  }
  return null;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function BillingPanel({ request }: BillingPanelProps) {
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [subscription, setSubscription] = useState<StoreSubscriptionView | null>(null);
  const [plans, setPlans] = useState<BillingPlanView[]>([]);
  const [invoices, setInvoices] = useState<BillingInvoicesPage | null>(null);
  const [receipts, setReceipts] = useState<BillingReceiptsPage | null>(null);
  const [selectedCycle, setSelectedCycle] = useState<SubscriptionBillingCycle>('monthly');
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(true);
  const [couponCode, setCouponCode] = useState('');
  const [couponQuote, setCouponQuote] = useState<{ finalAmount: number; discountAmount: number; couponCode: string } | null>(null);
  const [receiptForm, setReceiptForm] = useState({
    invoiceId: '',
    amount: '',
    currencyCode: 'YER',
    transactionReference: '',
    paymentMethod: '',
    paidAt: '',
    receiptMediaId: '',
    receiptFileName: '',
    receiptMimeType: '',
    receiptSizeBytes: 0,
    merchantNote: '',
  });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<SubscriptionReceiptView | null>(null);
  const focusedFeatureKey = useMemo(() => {
    if (typeof window === 'undefined') {
      return null;
    }
    return new URLSearchParams(window.location.search).get('feature');
  }, []);

  const daysRemaining = useMemo(() => {
    if (!subscription?.currentPeriodEnd) return null;
    const end = new Date(subscription.currentPeriodEnd);
    const now = new Date();
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  }, [subscription]);

  const loadData = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError('');
    try {
      const [centerRes, subscriptionRes, plansRes, invoicesRes, receiptsRes] = await Promise.all([
        request<MerchantBillingCenterResponse>('/billing/center', { method: 'GET' }).catch(() => null),
        request<StoreSubscriptionView>('/billing/subscription', { method: 'GET' }),
        request<BillingPlanView[]>('/billing/plans', { method: 'GET' }),
        request<BillingInvoicesPage>('/billing/invoices?page=1&limit=20', { method: 'GET' }),
        request<BillingReceiptsPage>('/billing/receipts?page=1&limit=20', { method: 'GET' }),
      ]);
      setSubscription(subscriptionRes ?? null);
      setPlans(centerRes?.availablePlans ?? plansRes ?? []);
      setInvoices(centerRes ? { items: centerRes.invoices, total: centerRes.invoices.length, page: 1, limit: 20 } : invoicesRes ?? { items: [], total: 0, page: 1, limit: 20 });
      setReceipts(centerRes ? { items: centerRes.receipts, total: centerRes.receipts.length, page: 1, limit: 20 } : receiptsRes ?? { items: [], total: 0, page: 1, limit: 20 });
      if (subscriptionRes?.billingCycle) {
        setSelectedCycle(subscriptionRes.billingCycle);
      }
      setCancelAtPeriodEnd(subscriptionRes?.cancelAtPeriodEnd ?? true);
    } catch {
      setError('فشل في تحميل بيانات الفوترة.');
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    loadData().catch(() => undefined);
  }, [loadData]);

  const currentPlanId = subscription?.plan.id ?? null;
  const currentPlanPrice = useMemo(() => {
    if (!subscription) {
      return null;
    }
    const cycle = selectedCycle;
    return resolvePlanPrice(
      {
        id: subscription.plan.id,
        code: subscription.plan.code,
        name: subscription.plan.name,
        description: subscription.plan.description,
        isActive: subscription.plan.isActive,
        monthlyPrice: subscription.plan.monthlyPrice,
        annualPrice: subscription.plan.annualPrice,
        monthlyCompareAtPrice: subscription.plan.monthlyCompareAtPrice,
        annualCompareAtPrice: subscription.plan.annualCompareAtPrice,
        currencyCode: subscription.plan.currencyCode,
        saleLabel: subscription.plan.saleLabel,
        saleStartsAt: subscription.plan.saleStartsAt,
        saleEndsAt: subscription.plan.saleEndsAt,
        isIntroOffer: subscription.plan.isIntroOffer,
        isSaleActive: subscription.plan.isSaleActive,
        isSaleVisible: subscription.plan.isSaleVisible,
        billingCycleOptions: ['monthly', 'annual'],
        trialDaysDefault: 0,
        limits: [],
        entitlements: [],
      },
      cycle,
    );
  }, [selectedCycle, subscription]);

  async function handleChangePlan(targetPlan: BillingPlanView): Promise<void> {
    if (!subscription) {
      return;
    }

    const targetPrice = resolvePlanPrice(targetPlan, selectedCycle);
    const mode = targetPrice !== null && currentPlanPrice !== null && targetPrice < currentPlanPrice
      ? 'downgrade'
      : 'upgrade';

    setWorking(true);
    setError('');
    setSuccess('');
    try {
      await request(`/billing/subscription/${mode}`, {
        method: 'POST',
        body: JSON.stringify({
          targetPlanCode: targetPlan.code,
          billingCycle: selectedCycle === 'manual' ? 'monthly' : selectedCycle,
          prorationMode: 'immediate_invoice',
        }),
      });
      setSuccess(`تم تغيير الخطة بنجاح إلى ${targetPlan.name}.`);
      await loadData();
    } catch (changeError) {
      setError(changeError instanceof Error ? changeError.message : 'فشل في تغيير الخطة.');
    } finally {
      setWorking(false);
    }
  }

  async function handleValidateCoupon(targetPlan: BillingPlanView): Promise<void> {
    if (!couponCode.trim()) {
      setCouponQuote(null);
      return;
    }
    setWorking(true);
    setError('');
    setSuccess('');
    try {
      const quote = await request<{ finalAmount: number; discountAmount: number; couponCode: string }>('/billing/coupons/validate', {
        method: 'POST',
        body: JSON.stringify({
          code: couponCode.trim(),
          planCode: targetPlan.code,
          billingCycle: selectedCycle === 'manual' ? 'monthly' : selectedCycle,
        }),
      });
      setCouponQuote(quote ?? null);
    } catch (couponError) {
      setCouponQuote(null);
      setError(couponError instanceof Error ? couponError.message : 'فشل في التحقق من الكوبون.');
    } finally {
      setWorking(false);
    }
  }

  async function handleRedeemCoupon(targetPlan: BillingPlanView): Promise<void> {
    if (!couponCode.trim()) {
      return;
    }
    setWorking(true);
    setError('');
    setSuccess('');
    try {
      await request('/billing/coupons/redeem', {
        method: 'POST',
        body: JSON.stringify({
          code: couponCode.trim(),
          planCode: targetPlan.code,
          billingCycle: selectedCycle === 'manual' ? 'monthly' : selectedCycle,
        }),
      });
      setSuccess(`تم تطبيق الكوبون ${couponCode.trim()} على ${targetPlan.name}.`);
      setCouponCode('');
      setCouponQuote(null);
      await loadData();
    } catch (couponError) {
      setError(couponError instanceof Error ? couponError.message : 'فشل في تطبيق الكوبون.');
    } finally {
      setWorking(false);
    }
  }

  async function handleCancelSubscription(): Promise<void> {
    setWorking(true);
    setError('');
    setSuccess('');
    try {
      await request('/billing/subscription/cancel', {
        method: 'POST',
        body: JSON.stringify({
          cancelAtPeriodEnd,
        }),
      });
      setSuccess(
        cancelAtPeriodEnd
          ? 'تم جدولة الإلغاء عند نهاية الفترة الحالية.'
          : 'تم إلغاء الاشتراك فوراً.',
      );
      await loadData();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : 'فشل في إلغاء الاشتراك.');
    } finally {
      setWorking(false);
    }
  }

  async function uploadReceiptFile(file: File): Promise<MediaAsset> {
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) {
      throw new Error('صيغة الملف غير مدعومة. الصيغ المسموحة: JPG, PNG, WEBP, PDF.');
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('حجم الملف أكبر من الحد المسموح (10MB).');
    }
    const presigned = await request<PresignedMediaUpload>('/media/presign-upload', {
      method: 'POST',
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type,
        fileSizeBytes: file.size,
      }),
    });
    if (!presigned) {
      throw new Error('تعذر تجهيز رفع الإيصال.');
    }
    const uploadResponse = await fetch(presigned.uploadUrl, {
      method: 'PUT',
      headers: presigned.uploadHeaders,
      body: file,
    });
    if (!uploadResponse.ok) {
      throw new Error('فشل رفع ملف الإيصال.');
    }
    const etag = uploadResponse.headers.get('etag')?.replaceAll('"', '') || undefined;
    const mediaAsset = await request<MediaAsset>('/media/confirm', {
      method: 'POST',
      body: JSON.stringify({
        objectKey: presigned.objectKey,
        fileName: file.name,
        contentType: file.type,
        fileSizeBytes: file.size,
        ...(etag ? { etag } : {}),
      }),
    });
    if (!mediaAsset) {
      throw new Error('تعذر تأكيد ملف الإيصال.');
    }
    return mediaAsset;
  }

  async function handleUploadReceipt(): Promise<void> {
    if (!receiptForm.invoiceId) {
      setError('يرجى اختيار الفاتورة.');
      return;
    }
    if (!receiptForm.transactionReference.trim()) {
      setError('يرجى إدخال رقم العملية.');
      return;
    }
    if (!receiptForm.amount || Number(receiptForm.amount) <= 0) {
      setError('يرجى إدخال مبلغ صحيح.');
      return;
    }
    if (!receiptForm.receiptMediaId && !receiptFile) {
      setError('يرجى رفع ملف الإيصال.');
      return;
    }
    setWorking(true);
    setError('');
    setSuccess('');
    try {
      const mediaAsset = receiptForm.receiptMediaId
        ? null
        : receiptFile
          ? await uploadReceiptFile(receiptFile)
          : null;
      await request('/billing/receipts', {
        method: 'POST',
        body: JSON.stringify({
          invoiceId: receiptForm.invoiceId,
          amount: Number(receiptForm.amount),
          currencyCode: 'YER',
          transactionReference: receiptForm.transactionReference.trim() || null,
          paymentMethod: receiptForm.paymentMethod.trim() || null,
          paidAt: receiptForm.paidAt || null,
          receiptMediaId: mediaAsset?.id ?? receiptForm.receiptMediaId,
          receiptFileName: mediaAsset ? receiptFile?.name ?? null : receiptForm.receiptFileName,
          receiptMimeType: (mediaAsset?.mimeType ?? receiptForm.receiptMimeType) || null,
          receiptSizeBytes: (mediaAsset?.fileSizeBytes ?? receiptForm.receiptSizeBytes) || null,
          merchantNote: receiptForm.merchantNote.trim() || null,
        }),
      });
      setSuccess('تم إرسال الإيصال للمراجعة بنجاح.');
      setReceiptForm({
        invoiceId: '',
        amount: '',
        currencyCode: 'YER',
        transactionReference: '',
        paymentMethod: '',
        paidAt: '',
        receiptMediaId: '',
        receiptFileName: '',
        receiptMimeType: '',
        receiptSizeBytes: 0,
        merchantNote: '',
      });
      setReceiptFile(null);
      setShowReceiptDialog(false);
      await loadData();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'تعذر رفع الإيصال.');
    } finally {
      setWorking(false);
    }
  }

  function openReceiptUploadDialog(invoiceId?: string): void {
    setReceiptForm({
      invoiceId: invoiceId ?? '',
      amount: '',
      currencyCode: 'YER',
      transactionReference: '',
      paymentMethod: '',
      paidAt: '',
      receiptMediaId: '',
      receiptFileName: '',
      receiptMimeType: '',
      receiptSizeBytes: 0,
      merchantNote: '',
    });
    setReceiptFile(null);
    setError('');
    setSuccess('');
    setShowReceiptDialog(true);
  }

  const status = subscription?.status ?? '';
  const statusLabel = subscriptionStatusLabels[status] ?? status;

  const expiryAlert = useMemo(() => {
    if (daysRemaining === null) return null;
    if (daysRemaining <= 0) {
      return { type: 'error' as const, message: 'انتهى اشتراكك، يرجى تجديد الاشتراك لمواصلة استخدام جميع الميزات.' };
    }
    if (daysRemaining <= 7) {
      return { type: 'warning' as const, message: `سينتهي اشتراكك خلال ${daysRemaining} يوم.` };
    }
    return null;
  }, [daysRemaining]);

  return (
    <AppPage>
      <PageHeader
        title="الفوترة والاشتراكات"
        description="إدارة الخطة الحالية، تغيير الباقة، ومراجعة الفواتير والإيصالات."
        actions={
          <Button variant="outlined" onClick={() => loadData().catch(() => undefined)} disabled={loading || working}>
            تحديث
          </Button>
        }
      />

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      {success ? <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert> : null}
      {expiryAlert ? <Alert severity={expiryAlert.type} sx={{ mb: 2 }}>{expiryAlert.message}</Alert> : null}

      {loading ? (
        <SectionCard>
          <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress />
          </Box>
        </SectionCard>
      ) : null}

      {!loading && subscription ? (
        <>
          <SectionCard>
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
                <Box>
                  <Typography variant="h6" fontWeight={800}>
                    الخطة الحالية: {subscription.plan.name}
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                    <Chip
                      size="small"
                      label={statusLabel}
                      color={
                        status === 'active' ? 'success' :
                        status === 'trialing' ? 'info' :
                        status === 'past_due' ? 'warning' :
                        status === 'suspended' ? 'error' :
                        status === 'expired' ? 'error' :
                        status === 'canceled' ? 'default' : 'default'
                      }
                    />
                    <Typography color="text.secondary">
                      دورة الفوترة: {billingCycleLabels[selectedCycle] ?? selectedCycle}
                    </Typography>
                  </Stack>
                </Box>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }}>
                  <FormControl size="small" sx={{ minWidth: 180 }}>
                    <InputLabel id="billing-cycle-label">دورة الفوترة</InputLabel>
                    <Select
                      labelId="billing-cycle-label"
                      label="دورة الفوترة"
                      value={selectedCycle}
                      onChange={(event) => setSelectedCycle(event.target.value as SubscriptionBillingCycle)}
                    >
                      <MenuItem value="monthly">شهري</MenuItem>
                      <MenuItem value="annual">سنوي</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ minWidth: 200 }}>
                    <InputLabel id="cancel-mode-label">وضع الإلغاء</InputLabel>
                    <Select
                      labelId="cancel-mode-label"
                      label="وضع الإلغاء"
                      value={cancelAtPeriodEnd ? 'period_end' : 'immediate'}
                      onChange={(event) => setCancelAtPeriodEnd(event.target.value === 'period_end')}
                    >
                      <MenuItem value="period_end">نهاية الفترة</MenuItem>
                      <MenuItem value="immediate">فوري</MenuItem>
                    </Select>
                  </FormControl>
                  <Button variant="outlined" color="error" onClick={() => handleCancelSubscription().catch(() => undefined)} disabled={working}>
                    إلغاء الاشتراك
                  </Button>
                </Stack>
              </Stack>

              <Divider />

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" color="text.secondary">بداية الفترة الحالية</Typography>
                  <Typography fontWeight={700}>{formatDate(subscription.startsAt)}</Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" color="text.secondary">نهاية الفترة الحالية</Typography>
                  <Typography fontWeight={700}>{formatDate(subscription.currentPeriodEnd)}</Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" color="text.secondary">الفوترة القادمة</Typography>
                  <Typography fontWeight={700}>{formatDate(subscription.nextBillingAt)}</Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" color="text.secondary">الأيام المتبقية</Typography>
                  <Typography fontWeight={700} color={daysRemaining !== null && daysRemaining <= 7 ? 'error.main' : 'primary.main'}>
                    {daysRemaining !== null ? `${daysRemaining} يوم` : '-'}
                  </Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" color="text.secondary">مبلغ التجديد</Typography>
                  <Typography fontWeight={700}>
                    {currentPlanPrice !== null ? formatAmount(currentPlanPrice, 'YER') : '-'}
                  </Typography>
                </Box>
              </Stack>
            </Stack>
          </SectionCard>

          <SectionCard>
            <Typography variant="h6" fontWeight={800}>
              حدود الاستخدام
            </Typography>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' } }}>
              <Stack spacing={1.2}>
                {subscription.usage.map((item) => {
                  const percentage = item.limit === null ? null : Math.min(100, Math.round((item.used / item.limit) * 100));
                  const color = percentage !== null && percentage >= 100 ? 'error' : percentage !== null && percentage >= 80 ? 'warning' : 'primary';
                  return (
                    <Box key={item.metricKey}>
                      <Stack direction="row" justifyContent="space-between" spacing={1}>
                        <Typography fontWeight={700}>{metricLabels[item.metricKey] ?? item.metricKey}</Typography>
                        <Typography color="text.secondary">
                          {item.limit === null ? `${item.used} / غير محدود` : `${item.used} / ${item.limit}`}
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant={percentage === null ? 'indeterminate' : 'determinate'}
                        value={percentage ?? 100}
                        color={color}
                        sx={{ mt: 0.7, height: 8, borderRadius: 1 }}
                      />
                      {percentage !== null && percentage >= 80 ? (
                        <Typography variant="caption" color={percentage >= 100 ? 'error.main' : 'warning.main'}>
                          {percentage >= 100 ? 'تم الوصول للحد. قم بترقية الخطة للمتابعة.' : 'اقتربت من حد الخطة.'}
                        </Typography>
                      ) : null}
                    </Box>
                  );
                })}
              </Stack>
              <Stack spacing={1.2}>
                <Typography fontWeight={800}>المميزات المشمولة</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {subscription.entitlements.map((item) => (
                    <Chip
                      key={item.featureKey}
                      size="small"
                      color={item.isEnabled ? 'success' : 'default'}
                      variant={item.isEnabled ? 'filled' : 'outlined'}
                      label={`${featureLabels[item.featureKey] ?? item.featureKey}: ${item.isEnabled ? 'مشمول' : 'ترقية مطلوبة'}`}
                    />
                  ))}
                </Box>
              </Stack>
            </Box>
          </SectionCard>

          <SectionCard>
            <Typography variant="h6" fontWeight={800}>
              الخطط المتاحة
            </Typography>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', lg: 'repeat(3, minmax(0, 1fr))' } }}>
              {plans.map((plan) => {
                const isCurrent = plan.id === currentPlanId;
                const price = resolvePlanPrice(plan, selectedCycle);
                const compareAtPrice = resolvePlanCompareAtPrice(plan, selectedCycle);
                const enabledEntitlements = plan.entitlements.filter((item) => item.isEnabled).length;
                const includesFocusedFeature = focusedFeatureKey
                  ? plan.entitlements.some((item) => item.featureKey === focusedFeatureKey && item.isEnabled)
                  : false;
                return (
                  <SectionCard
                    key={plan.id}
                    sx={{
                      borderColor: isCurrent ? 'primary.main' : includesFocusedFeature ? 'success.main' : 'divider',
                    }}
                  >
                    <Stack spacing={1.1}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="h6" fontWeight={800}>
                          {plan.name}
                        </Typography>
                        <Stack direction="row" spacing={0.75} alignItems="center">
                          {includesFocusedFeature ? (
                            <Chip
                              size="small"
                              color="success"
                              label={`يشمل ${featureLabels[focusedFeatureKey ?? ''] ?? focusedFeatureKey}`}
                            />
                          ) : null}
                          {isCurrent ? <Chip size="small" color="primary" label="الخطة الحالية" /> : null}
                        </Stack>
                      </Stack>
                      <Typography color="text.secondary">{plan.description ?? 'لا يوجد وصف.'}</Typography>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        {compareAtPrice !== null ? (
                          <Typography color="text.secondary" sx={{ textDecoration: 'line-through' }}>
                            {formatAmount(compareAtPrice, plan.currencyCode)}
                          </Typography>
                        ) : null}
                        <Typography variant="h5" color="primary.main" fontWeight={900}>
                          {price === null ? 'غير متاح' : formatAmount(price, plan.currencyCode)}
                        </Typography>
                        {plan.isSaleVisible ? <Chip size="small" color="success" label={plan.saleLabel ?? 'عرض'} /> : null}
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        {enabledEntitlements} ميزة مفعّلة | {plan.limits.length} حد
                      </Typography>
                      {!isCurrent ? (
                        <Stack spacing={1}>
                          <TextField
                            size="small"
                            label="كوبون الاشتراك"
                            value={couponCode}
                            onChange={(event) => setCouponCode(event.target.value)}
                          />
                          {couponQuote ? (
                            <Alert severity="success">
                              الكوبون {couponQuote.couponCode}: خصم {formatAmount(couponQuote.discountAmount, plan.currencyCode)}؛ الإجمالي {formatAmount(couponQuote.finalAmount, plan.currencyCode)}
                            </Alert>
                          ) : null}
                          <Stack direction="row" spacing={1}>
                            <Button variant="outlined" disabled={working || !couponCode.trim()} onClick={() => handleValidateCoupon(plan).catch(() => undefined)}>
                              تطبيق الكوبون
                            </Button>
                            <Button variant="contained" disabled={working || !couponQuote} onClick={() => handleRedeemCoupon(plan).catch(() => undefined)}>
                              الاشتراك باستخدام كوبون
                            </Button>
                          </Stack>
                        </Stack>
                      ) : null}
                      <Button
                        variant={isCurrent ? 'outlined' : 'contained'}
                        disabled={isCurrent || working}
                        onClick={() => handleChangePlan(plan).catch(() => undefined)}
                      >
                        {isCurrent ? 'الخطة الحالية' : 'اختيار الخطة'}
                      </Button>
                    </Stack>
                  </SectionCard>
                );
              })}
            </Box>
          </SectionCard>

          <SectionCard>
            <Typography variant="h6" fontWeight={800}>
              كوبون التفعيل أو الخصم
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              لديك كوبون تفعيل أو خصم؟ أدخل الكود أدناه.
            </Typography>
            <Divider sx={{ my: 2 }} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="flex-end">
              <TextField
                size="small"
                label="أدخل كود الكوبون"
                value={couponCode}
                onChange={(event) => setCouponCode(event.target.value)}
                sx={{ flex: 1 }}
              />
              <Button
                variant="outlined"
                disabled={working || !couponCode.trim()}
                onClick={() => {
                  const currentPlan = plans.find(p => p.id === currentPlanId) ?? plans[0];
                  if (currentPlan) {
                    handleValidateCoupon(currentPlan).catch(() => undefined);
                  }
                }}
              >
                تطبيق الكوبون
              </Button>
            </Stack>
            {couponQuote ? (
              <Alert severity="success" sx={{ mt: 2 }}>
                <Typography fontWeight={700}>نتيجة الكوبون: {couponQuote.couponCode}</Typography>
                <Typography>مبلغ الخصم: {formatAmount(couponQuote.discountAmount, 'YER')}</Typography>
                <Typography>المبلغ المطلوب: {couponQuote.finalAmount > 0 ? formatAmount(couponQuote.finalAmount, 'YER') : 'لا يوجد مبلغ مستحق'}</Typography>
              </Alert>
            ) : null}
          </SectionCard>

          <SectionCard>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Box>
                <Typography variant="h6" fontWeight={800}>
                  الفواتير
                </Typography>
                <Typography color="text.secondary">مراجعة الفواتير ورفع إيصالات الدفع.</Typography>
              </Box>
            </Stack>
            <Divider sx={{ my: 2 }} />
            <DataTableWrapper>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>رقم الفاتورة</TableCell>
                    <TableCell>الخطة / الدورة</TableCell>
                    <TableCell>الفترة</TableCell>
                    <TableCell>الحالة</TableCell>
                    <TableCell>الكوبون</TableCell>
                    <TableCell>المبلغ</TableCell>
                    <TableCell>تاريخ الإصدار</TableCell>
                    <TableCell>تاريخ الاستحقاق</TableCell>
                    <TableCell>تاريخ الدفع</TableCell>
                    <TableCell>إجراء</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(invoices?.items ?? []).map((invoice) => (
                    <TableRow key={invoice.id} hover>
                      <TableCell>{invoice.invoiceNumber}</TableCell>
                      <TableCell>{billingCycleLabels[invoice.billingCycle] ?? invoice.billingCycle}</TableCell>
                      <TableCell>
                        {formatDate(invoice.periodStart)} - {formatDate(invoice.periodEnd)}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={invoiceStatusLabels[invoice.status]}
                          color={invoiceStatusColors[invoice.status]}
                        />
                      </TableCell>
                      <TableCell>
                        {invoice.couponCode ? (
                          <Chip size="small" label={`${invoice.couponCode} -${formatAmount(invoice.discountAmount, invoice.currencyCode)}`} />
                        ) : '-'}
                      </TableCell>
                      <TableCell>{formatAmount(invoice.totalAmount, invoice.currencyCode)}</TableCell>
                      <TableCell>{formatDate(invoice.createdAt)}</TableCell>
                      <TableCell>{formatDate(invoice.dueAt)}</TableCell>
                      <TableCell>{formatDate(invoice.paidAt)}</TableCell>
                      <TableCell>
                        {(invoice.status === 'open' || invoice.status === 'failed') ? (
                          <Button size="small" variant="outlined" onClick={() => openReceiptUploadDialog(invoice.id)}>
                            رفع إيصال
                          </Button>
                        ) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(invoices?.items.length ?? 0) === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} align="center">
                        <Typography color="text.secondary" sx={{ py: 3 }}>
                          لا توجد فواتير.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </DataTableWrapper>
          </SectionCard>

          <SectionCard>
            <Typography variant="h6" fontWeight={800}>
              إيصالات الاشتراك
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              حالة الإيصالات المرفوعة للمراجعة.
            </Typography>
            <Divider sx={{ my: 2 }} />
            <DataTableWrapper>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>الفاتورة</TableCell>
                    <TableCell>الحالة</TableCell>
                    <TableCell>المبلغ</TableCell>
                    <TableCell>رقم العملية</TableCell>
                    <TableCell>ملف الإيصال</TableCell>
                    <TableCell>تاريخ الإرسال</TableCell>
                    <TableCell>سبب الرفض</TableCell>
                    <TableCell>إجراء</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(receipts?.items ?? []).map((receipt) => (
                    <TableRow key={receipt.id} hover>
                      <TableCell>{receipt.invoiceNumber ?? receipt.invoiceId}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={receiptStatusLabels[receipt.status]}
                          color={receipt.status === 'approved' ? 'success' : receipt.status === 'rejected' ? 'error' : receipt.status === 'pending_review' ? 'warning' : 'default'}
                        />
                      </TableCell>
                      <TableCell>{formatAmount(receipt.amount, receipt.currencyCode)}</TableCell>
                      <TableCell>{receipt.transactionReference ?? '-'}</TableCell>
                      <TableCell>
                        {receipt.receiptFileName ? (
                          <Chip
                            size="small"
                            label={receipt.receiptFileName}
                            variant="outlined"
                            onClick={() => setSelectedReceipt(receipt)}
                            sx={{ cursor: 'pointer' }}
                          />
                        ) : '-'}
                      </TableCell>
                      <TableCell>{formatDateTime(receipt.createdAt)}</TableCell>
                      <TableCell>{receipt.rejectionReason ?? '-'}</TableCell>
                      <TableCell>
                        <Button size="small" variant="text" onClick={() => setSelectedReceipt(receipt)}>
                          عرض التفاصيل
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(receipts?.items.length ?? 0) === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center">
                        <Typography color="text.secondary" sx={{ py: 3 }}>
                          لا توجد إيصالات اشتراك.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </DataTableWrapper>
          </SectionCard>
        </>
      ) : null}

      <Dialog open={showReceiptDialog} onClose={working ? undefined : () => setShowReceiptDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle>رفع إيصال الدفع</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            اختر الفاتورة المفتوحة التي دفعتها.
          </Typography>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              select
              label="الفاتورة"
              value={receiptForm.invoiceId}
              onChange={(event) => {
                const invoice = invoices?.items.find((item) => item.id === event.target.value);
                setReceiptForm({
                  ...receiptForm,
                  invoiceId: event.target.value,
                  amount: invoice ? String(invoice.totalAmount) : receiptForm.amount,
                  currencyCode: invoice?.currencyCode ?? receiptForm.currencyCode,
                });
              }}
              fullWidth
            >
              {(invoices?.items ?? []).filter((invoice) => invoice.status === 'open' || invoice.status === 'failed').map((invoice) => (
                <MenuItem key={invoice.id} value={invoice.id}>
                  {invoice.invoiceNumber} - {formatAmount(invoice.totalAmount, invoice.currencyCode)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="طريقة الدفع"
              value={receiptForm.paymentMethod}
              onChange={(event) => setReceiptForm({ ...receiptForm, paymentMethod: event.target.value })}
              placeholder="تحويل بنكي، حوالة، إلخ"
              fullWidth
            />
            <TextField
              label="رقم العملية أو الحوالة"
              value={receiptForm.transactionReference}
              onChange={(event) => setReceiptForm({ ...receiptForm, transactionReference: event.target.value })}
              fullWidth
            />
            <TextField
              label="المبلغ المدفوع"
              type="number"
              value={receiptForm.amount}
              onChange={(event) => setReceiptForm({ ...receiptForm, amount: event.target.value })}
              fullWidth
            />
            <TextField
              label="تاريخ الدفع"
              type="date"
              value={receiptForm.paidAt}
              onChange={(event) => setReceiptForm({ ...receiptForm, paidAt: event.target.value })}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <Box>
              <Typography variant="body2" fontWeight={700} sx={{ mb: 1 }}>ملف الإيصال</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                ارفع صورة أو ملف PDF للإيصال
              </Typography>
              <Button
                component="label"
                variant="outlined"
                startIcon={<CloudUploadIcon />}
                fullWidth
                sx={{ minHeight: 56 }}
              >
                {receiptFile?.name || receiptForm.receiptFileName || 'اختر صورة أو PDF للإيصال'}
                <input
                  hidden
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setReceiptFile(file);
                    setReceiptForm({
                      ...receiptForm,
                      receiptMediaId: '',
                      receiptFileName: file?.name ?? '',
                      receiptMimeType: file?.type ?? '',
                      receiptSizeBytes: file?.size ?? 0,
                    });
                  }}
                />
              </Button>
            </Box>
            <TextField
              label="ملاحظة (اختياري)"
              value={receiptForm.merchantNote}
              onChange={(event) => setReceiptForm({ ...receiptForm, merchantNote: event.target.value })}
              multiline
              minRows={2}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowReceiptDialog(false)} disabled={working}>إلغاء</Button>
          <Button variant="contained" disabled={working} onClick={() => handleUploadReceipt().catch(() => undefined)}>
            إرسال للمراجعة
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(selectedReceipt)} onClose={() => setSelectedReceipt(null)} fullWidth maxWidth="sm">
        <DialogTitle>تفاصيل الإيصال</DialogTitle>
        <DialogContent>
          {selectedReceipt ? (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Stack direction="row" justifyContent="space-between">
                <Typography color="text.secondary">الفاتورة</Typography>
                <Typography fontWeight={700}>{selectedReceipt.invoiceNumber ?? selectedReceipt.invoiceId}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography color="text.secondary">الحالة</Typography>
                <Chip
                  size="small"
                  label={receiptStatusLabels[selectedReceipt.status]}
                  color={selectedReceipt.status === 'approved' ? 'success' : selectedReceipt.status === 'rejected' ? 'error' : 'warning'}
                />
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography color="text.secondary">المبلغ</Typography>
                <Typography fontWeight={700}>{formatAmount(selectedReceipt.amount, selectedReceipt.currencyCode)}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography color="text.secondary">رقم العملية</Typography>
                <Typography>{selectedReceipt.transactionReference ?? '-'}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography color="text.secondary">ملف الإيصال</Typography>
                <Typography>{selectedReceipt.receiptFileName ?? '-'}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography color="text.secondary">تاريخ الإرسال</Typography>
                <Typography>{formatDateTime(selectedReceipt.createdAt)}</Typography>
              </Stack>
              {selectedReceipt.rejectionReason ? (
                <Alert severity="error">
                  <Typography fontWeight={700}>سبب الرفض:</Typography>
                  <Typography>{selectedReceipt.rejectionReason}</Typography>
                </Alert>
              ) : null}
              {selectedReceipt.merchantNote ? (
                <Box>
                  <Typography color="text.secondary">ملاحظتك:</Typography>
                  <Typography>{selectedReceipt.merchantNote}</Typography>
                </Box>
              ) : null}
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedReceipt(null)}>إغلاق</Button>
        </DialogActions>
      </Dialog>
    </AppPage>
  );
}

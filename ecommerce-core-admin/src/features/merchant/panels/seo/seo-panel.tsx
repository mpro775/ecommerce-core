import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  LinearProgress,
  MenuItem,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import type { MerchantRequester } from '../../merchant-dashboard.types';
import type {
  MediaAsset,
  PresignedMediaUpload,
  SeoAuditDetailsResponse,
  SeoAutoFixResponse,
  SeoIssue,
  SeoSuggestionResponse,
  StoreSeoSettings,
} from '../../types';
import { AppPage, FormSection, PageHeader } from '../../components/ui';
import { clearFieldErrors, isApiError, mapFieldErrors } from '../../../../lib/api-error';

interface SeoPanelProps {
  request: MerchantRequester;
}

type SeoTab = 'overview' | 'home' | 'issues' | 'integrations' | 'advanced';
type IssueFilter = 'all' | 'product' | 'category' | 'page' | 'home' | 'critical' | 'auto';
type SeoOverwriteMode = 'missing_only' | 'improve_weak' | 'replace_all';

const EMPTY_SETTINGS: StoreSeoSettings = {
  homeSeoTitleAr: null,
  homeSeoTitleEn: null,
  homeSeoDescriptionAr: null,
  homeSeoDescriptionEn: null,
  defaultSeoTitleAr: null,
  defaultSeoTitleEn: null,
  defaultSeoDescriptionAr: null,
  defaultSeoDescriptionEn: null,
  defaultOgImage: null,
  defaultTwitterImage: null,
  keywords: [],
  googleSiteVerification: null,
  googleAnalyticsMeasurementId: null,
  bingSiteVerification: null,
  facebookDomainVerification: null,
  seoIndexEnabled: true,
  seoFollowDefault: true,
  canonicalBaseUrl: null,
  defaultLanguage: 'ar',
  supportedLanguages: ['ar', 'en'],
};

const STATUS_LABELS: Record<SeoAuditDetailsResponse['status'], string> = {
  excellent: 'ممتاز',
  good: 'جيد',
  needs_improvement: 'يحتاج تحسين',
  poor: 'ضعيف',
};

export function SeoPanel({ request }: SeoPanelProps) {
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [tab, setTab] = useState<SeoTab>('overview');
  const [settings, setSettings] = useState<StoreSeoSettings>(EMPTY_SETTINGS);
  const [audit, setAudit] = useState<SeoAuditDetailsResponse | null>(null);
  const [issueFilter, setIssueFilter] = useState<IssueFilter>('all');
  const [overwriteMode, setOverwriteMode] = useState<SeoOverwriteMode>('missing_only');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [autoFixing, setAutoFixing] = useState(false);
  const [confirmDisableIndex, setConfirmDisableIndex] = useState(false);
  const [suggestion, setSuggestion] = useState<SeoSuggestionResponse['suggestions'] | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string }>({ type: 'info', text: '' });

  useEffect(() => {
    load().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const issues = useMemo(() => audit?.sections.flatMap((section) => section.issues) ?? [], [audit]);
  const filteredIssues = useMemo(() => filterIssues(issues, issueFilter), [issues, issueFilter]);
  const previewTitle = settings.homeSeoTitleAr || settings.defaultSeoTitleAr || settings.homeSeoTitleEn || 'عنوان متجرك في Google';
  const previewDescription = settings.homeSeoDescriptionAr || settings.defaultSeoDescriptionAr || settings.homeSeoDescriptionEn || 'وصف مختصر يظهر أسفل عنوان المتجر في Google ويشرح للعميل ماذا يبيع المتجر.';
  const titleAdvice = lengthAdvice(previewTitle, 30, 70);
  const descriptionAdvice = lengthAdvice(previewDescription, 80, 170);

  async function load(): Promise<void> {
    setLoading(true);
    try {
      const [settingsData, auditData] = await Promise.all([
        request<StoreSeoSettings>('/merchant/seo/settings'),
        request<SeoAuditDetailsResponse>('/merchant/seo/audit/details'),
      ]);
      setSettings(settingsData ?? EMPTY_SETTINGS);
      setAudit(auditData ?? null);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'تعذر تحميل بيانات SEO' });
    } finally {
      setLoading(false);
    }
  }

  async function save(force = false): Promise<void> {
    if (!force && settings.seoIndexEnabled === false) {
      setConfirmDisableIndex(true);
      return;
    }
    setSaving(true);
    setMessage({ type: 'info', text: '' });
    setFieldErrors({});
    try {
      const updated = await request<StoreSeoSettings>('/merchant/seo/settings', {
        method: 'PATCH',
        body: JSON.stringify(settings),
      });
      if (updated) setSettings(updated);
      setMessage({ type: 'success', text: 'تم حفظ إعدادات الظهور في Google.' });
      const auditData = await request<SeoAuditDetailsResponse>('/merchant/seo/audit/details');
      setAudit(auditData ?? null);
    } catch (error) {
      if (isApiError(error)) {
        setFieldErrors(mapSeoSettingsFieldErrors(error.fieldErrors));
      }
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'تعذر حفظ إعدادات SEO' });
    } finally {
      setSaving(false);
      setConfirmDisableIndex(false);
    }
  }

  async function autoFix(scope: 'all' | 'home' | 'products' | 'categories' | 'pages', issue?: SeoIssue): Promise<void> {
    setAutoFixing(true);
    setMessage({ type: 'info', text: '' });
    try {
      const result = await request<SeoAutoFixResponse>('/merchant/seo/auto-fix', {
        method: 'POST',
        body: JSON.stringify({
          scope,
          language: 'both',
          overwriteMode,
          targetId: issue?.targetId ?? undefined,
          issueType: issue?.issueType ?? undefined,
        }),
      });
      const skippedReason = result?.details?.find((item) => item.status === 'skipped' && item.reason)?.reason;
      setMessage({
        type: 'success',
        text: `تم إصلاح ${result?.fixed ?? result?.fixedCount ?? 0} عنصر. تم تخطي ${result?.skipped ?? result?.skippedCount ?? 0} عنصر. فشل ${result?.failed ?? result?.failedCount ?? 0} عنصر.${skippedReason ? ` سبب التخطي: ${skippedReason}` : ''}`,
      });
      await load();
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'تعذر تنفيذ الإصلاح التلقائي' });
    } finally {
      setAutoFixing(false);
    }
  }

  async function suggestHomeSeo(): Promise<void> {
    const result = await request<SeoSuggestionResponse>('/merchant/seo/suggestions', {
      method: 'POST',
      body: JSON.stringify({ targetType: 'home', language: 'both' }),
    });
    setSuggestion(result?.suggestions ?? null);
  }

  async function handleOgImageUpload(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const asset = await uploadMediaAsset(request, file);
      update('defaultOgImage', asset.url);
      update('defaultTwitterImage', asset.url);
      setMessage({ type: 'success', text: 'تم رفع صورة المشاركة. اضغط حفظ لاعتمادها.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'تعذر رفع الصورة' });
    } finally {
      setUploading(false);
    }
  }

  function update<K extends keyof StoreSeoSettings>(key: K, value: StoreSeoSettings[K]): void {
    setFieldErrors((current) => clearFieldErrors(current, [key]));
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function useSuggestion(): void {
    if (!suggestion) return;
    setSettings((current) => ({
      ...current,
      homeSeoTitleAr: suggestion.titleAr,
      homeSeoDescriptionAr: suggestion.descriptionAr,
      homeSeoTitleEn: suggestion.titleEn,
      homeSeoDescriptionEn: suggestion.descriptionEn,
    }));
    setSuggestion(null);
  }

  if (loading) {
    return (
      <AppPage maxWidth={1180}>
        <LinearProgress />
      </AppPage>
    );
  }

  return (
    <AppPage maxWidth={1180}>
      <PageHeader
        title="مركز تحسين الظهور في Google"
        description="تابع حالة ظهور متجرك، أصلح المشاكل الشائعة تلقائيًا، واترك الإعدادات التقنية عند الحاجة فقط."
        actions={(
          <Button variant="contained" onClick={() => save().catch(() => undefined)} disabled={saving || uploading}>
            {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </Button>
        )}
      />

      {message.text ? <Alert severity={message.type}>{message.text}</Alert> : null}

      <Tabs value={tab} onChange={(_, value: SeoTab) => setTab(value)} variant="scrollable" allowScrollButtonsMobile sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tab value="overview" label="نظرة عامة" />
        <Tab value="home" label="الصفحة الرئيسية" />
        <Tab value="issues" label="المشاكل والإصلاحات" />
        <Tab value="integrations" label="الربط والتحقق" />
        <Tab value="advanced" label="إعدادات متقدمة" />
      </Tabs>

      {tab === 'overview' ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.1fr 0.9fr' }, gap: 2 }}>
          <Stack spacing={2}>
            <HealthCard audit={audit} onAutoFix={() => autoFix('all').catch(() => undefined)} onShowIssues={() => setTab('issues')} busy={autoFixing} />
            <Checklist audit={audit} onAction={(key) => {
              if (key === 'products') void autoFix('products');
              else if (key === 'categories') void autoFix('categories');
              else if (key === 'og_image' || key === 'analytics') setTab(key === 'analytics' ? 'integrations' : 'home');
              else setTab('issues');
            }} />
          </Stack>
          <GooglePreview title={previewTitle} description={previewDescription} titleAdvice={titleAdvice} descriptionAdvice={descriptionAdvice} />
        </Box>
      ) : null}

      {tab === 'home' ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.1fr 0.9fr' }, gap: 2 }}>
          <FormSection title="ظهور الصفحة الرئيسية في Google" description="هذه أهم بيانات SEO للمتجر. اكتبها بلغة بسيطة يفهمها العميل.">
            <Stack spacing={2}>
              <TextField label="عنوان الصفحة الرئيسية عربي" value={settings.homeSeoTitleAr ?? ''} error={Boolean(fieldErrors.homeSeoTitleAr)} onChange={(event) => update('homeSeoTitleAr', event.target.value)} helperText={fieldErrors.homeSeoTitleAr || `${(settings.homeSeoTitleAr ?? '').length} / 70 - ${lengthAdvice(settings.homeSeoTitleAr ?? '', 30, 70).label}`} />
              <TextField label="وصف الصفحة الرئيسية عربي" multiline minRows={3} value={settings.homeSeoDescriptionAr ?? ''} error={Boolean(fieldErrors.homeSeoDescriptionAr)} onChange={(event) => update('homeSeoDescriptionAr', event.target.value)} helperText={fieldErrors.homeSeoDescriptionAr || `${(settings.homeSeoDescriptionAr ?? '').length} / 170 - ${lengthAdvice(settings.homeSeoDescriptionAr ?? '', 80, 170).label}`} />
              <TextField label="عنوان الصفحة الرئيسية إنجليزي" value={settings.homeSeoTitleEn ?? ''} error={Boolean(fieldErrors.homeSeoTitleEn)} helperText={fieldErrors.homeSeoTitleEn} onChange={(event) => update('homeSeoTitleEn', event.target.value)} />
              <TextField label="وصف الصفحة الرئيسية إنجليزي" multiline minRows={2} value={settings.homeSeoDescriptionEn ?? ''} error={Boolean(fieldErrors.homeSeoDescriptionEn)} helperText={fieldErrors.homeSeoDescriptionEn} onChange={(event) => update('homeSeoDescriptionEn', event.target.value)} />
              <ShareImage settings={settings} uploading={uploading} onUpload={() => imageInputRef.current?.click()} />
              <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => { handleOgImageUpload(event).catch(() => undefined); }} />
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Button variant="outlined" onClick={() => suggestHomeSeo().catch(() => undefined)}>اقترح لي عنوان ووصف</Button>
                <Button variant="contained" onClick={() => save().catch(() => undefined)} disabled={saving}>حفظ الصفحة الرئيسية</Button>
              </Stack>
              {suggestion ? (
                <Alert severity="info" action={<Button onClick={useSuggestion}>استخدام هذا الاقتراح</Button>}>
                  <Typography fontWeight={800}>{suggestion.titleAr}</Typography>
                  <Typography variant="body2">{suggestion.descriptionAr}</Typography>
                </Alert>
              ) : null}
            </Stack>
          </FormSection>
          <GooglePreview title={previewTitle} description={previewDescription} titleAdvice={titleAdvice} descriptionAdvice={descriptionAdvice} />
        </Box>
      ) : null}

      {tab === 'issues' ? (
        <Stack spacing={2}>
          <FormControlLabel
            control={<Checkbox checked={overwriteMode !== 'replace_all'} onChange={(event) => setOverwriteMode(event.target.checked ? 'missing_only' : 'replace_all')} />}
            label="لا تستبدل بيانات SEO المكتوبة مسبقًا"
          />
          <TextField select label="طريقة الإصلاح" value={overwriteMode} onChange={(event) => setOverwriteMode(event.target.value as SeoOverwriteMode)} sx={{ maxWidth: 420 }}>
            <MenuItem value="missing_only">إصلاح الحقول الفارغة فقط</MenuItem>
            <MenuItem value="improve_weak">تحسين الحقول الضعيفة أيضًا</MenuItem>
            <MenuItem value="replace_all">استبدال بيانات SEO الحالية</MenuItem>
          </TextField>
          {overwriteMode === 'replace_all' ? <Alert severity="warning">سيتم استبدال بيانات SEO الحالية داخل النطاق المحدد. استخدم هذا الخيار فقط عند رغبتك بإعادة توليد النصوص بالكامل.</Alert> : null}
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button variant="contained" onClick={() => autoFix('all').catch(() => undefined)} disabled={autoFixing}>إصلاح الكل</Button>
            <Button variant="outlined" onClick={() => autoFix('products').catch(() => undefined)} disabled={autoFixing}>إصلاح المنتجات فقط</Button>
            <Button variant="outlined" onClick={() => autoFix('categories').catch(() => undefined)} disabled={autoFixing}>إصلاح التصنيفات فقط</Button>
            <Button variant="outlined" onClick={() => autoFix('pages').catch(() => undefined)} disabled={autoFixing}>إصلاح الصفحات فقط</Button>
          </Stack>
          <TextField select label="تصفية المشاكل" value={issueFilter} onChange={(event) => setIssueFilter(event.target.value as IssueFilter)} sx={{ maxWidth: 320 }}>
            <MenuItem value="all">كل المشاكل</MenuItem>
            <MenuItem value="product">المنتجات</MenuItem>
            <MenuItem value="category">التصنيفات</MenuItem>
            <MenuItem value="page">الصفحات</MenuItem>
            <MenuItem value="home">الصفحة الرئيسية</MenuItem>
            <MenuItem value="critical">مشاكل حرجة</MenuItem>
            <MenuItem value="auto">قابلة للإصلاح تلقائيًا</MenuItem>
          </TextField>
          <IssueList issues={filteredIssues} onFix={(issue) => autoFix(scopeForIssue(issue), issue).catch(() => undefined)} />
        </Stack>
      ) : null}

      {tab === 'integrations' ? (
        <FormSection title="الربط والتحقق" description="انسخ الرموز من أدوات Google وBing وضعها هنا لتأكيد ملكية متجرك وقياس الزيارات.">
          <Stack spacing={2}>
            <IntegrationStatus label="Google Search Console" connected={Boolean(settings.googleSiteVerification)} />
            <TextField label="رمز التحقق من Google Search Console" dir="ltr" value={settings.googleSiteVerification ?? ''} error={Boolean(fieldErrors.googleSiteVerification)} onChange={(event) => update('googleSiteVerification', event.target.value)} helperText={fieldErrors.googleSiteVerification || 'انسخ رمز التحقق من Google Search Console وضعه هنا لتأكيد ملكية متجرك.'} />
            <IntegrationStatus label="Google Analytics" connected={Boolean(settings.googleAnalyticsMeasurementId)} />
            <TextField label="معرف Google Analytics Measurement ID" dir="ltr" placeholder="G-XXXXXXXXXX" value={settings.googleAnalyticsMeasurementId ?? ''} error={Boolean(fieldErrors.googleAnalyticsMeasurementId)} helperText={fieldErrors.googleAnalyticsMeasurementId} onChange={(event) => update('googleAnalyticsMeasurementId', event.target.value)} />
            <TextField label="رمز التحقق من Bing" dir="ltr" value={settings.bingSiteVerification ?? ''} error={Boolean(fieldErrors.bingSiteVerification)} helperText={fieldErrors.bingSiteVerification} onChange={(event) => update('bingSiteVerification', event.target.value)} />
            <TextField label="رمز تحقق Facebook Domain" dir="ltr" value={settings.facebookDomainVerification ?? ''} error={Boolean(fieldErrors.facebookDomainVerification)} helperText={fieldErrors.facebookDomainVerification} onChange={(event) => update('facebookDomainVerification', event.target.value)} />
          </Stack>
        </FormSection>
      ) : null}

      {tab === 'advanced' ? (
        <FormSection title="إعدادات متقدمة" description="هذه إعدادات متقدمة. لا تغيّرها إلا إذا كنت تعرف ما تفعل أو طلب منك فريق الدعم ذلك.">
          <Stack spacing={2}>
            <Alert severity="warning">إيقاف ظهور المتجر في Google قد يمنع Google من عرض متجرك في نتائج البحث.</Alert>
            <TextField label="النطاق الرسمي للمتجر" dir="ltr" value={settings.canonicalBaseUrl ?? ''} error={Boolean(fieldErrors.canonicalBaseUrl)} helperText={fieldErrors.canonicalBaseUrl} onChange={(event) => update('canonicalBaseUrl', event.target.value)} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <FormControlLabel control={<Switch checked={settings.seoIndexEnabled} onChange={(event) => update('seoIndexEnabled', event.target.checked)} />} label="إظهار المتجر في Google" />
              <FormControlLabel control={<Switch checked={settings.seoFollowDefault} onChange={(event) => update('seoFollowDefault', event.target.checked)} />} label="السماح بتتبع الروابط" />
            </Stack>
            <TextField select label="اللغة الافتراضية" value={settings.defaultLanguage} error={Boolean(fieldErrors.defaultLanguage)} helperText={fieldErrors.defaultLanguage} onChange={(event) => update('defaultLanguage', event.target.value as StoreSeoSettings['defaultLanguage'])}>
              <MenuItem value="ar">العربية</MenuItem>
              <MenuItem value="en">English</MenuItem>
            </TextField>
            <TextField label="الكلمات المفتاحية" value={settings.keywords.join(', ')} error={Boolean(fieldErrors.keywords)} onChange={(event) => update('keywords', event.target.value.split(',').map((item) => item.trim()).filter(Boolean))} helperText={fieldErrors.keywords || 'اختياري. افصل الكلمات بفاصلة.'} />
            <TextField label="عنوان افتراضي عربي" value={settings.defaultSeoTitleAr ?? ''} error={Boolean(fieldErrors.defaultSeoTitleAr)} helperText={fieldErrors.defaultSeoTitleAr} onChange={(event) => update('defaultSeoTitleAr', event.target.value)} />
            <TextField label="وصف افتراضي عربي" multiline minRows={2} value={settings.defaultSeoDescriptionAr ?? ''} error={Boolean(fieldErrors.defaultSeoDescriptionAr)} helperText={fieldErrors.defaultSeoDescriptionAr} onChange={(event) => update('defaultSeoDescriptionAr', event.target.value)} />
          </Stack>
        </FormSection>
      ) : null}

      <Dialog open={confirmDisableIndex} onClose={() => setConfirmDisableIndex(false)}>
        <DialogTitle>هل أنت متأكد؟</DialogTitle>
        <DialogContent>
          <Typography>إيقاف هذا الخيار يعني أن Google قد لا يعرض متجرك في نتائج البحث.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDisableIndex(false)}>إلغاء</Button>
          <Button color="warning" variant="contained" onClick={() => save(true).catch(() => undefined)}>نعم، أوقف الظهور في Google</Button>
        </DialogActions>
      </Dialog>
    </AppPage>
  );
}

function HealthCard({ audit, onAutoFix, onShowIssues, busy }: { audit: SeoAuditDetailsResponse | null; onAutoFix: () => void; onShowIssues: () => void; busy: boolean }) {
  const score = audit?.score ?? 0;
  return (
    <Box sx={{ p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}>
      <Typography variant="subtitle2" color="text.secondary">صحة ظهور متجرك في Google</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2}>
        <Box>
          <Typography variant="h2" fontWeight={900}>{score}%</Typography>
          <Typography color="text.secondary">{STATUS_LABELS[audit?.status ?? 'poor']}، يوجد {audit?.totalIssues ?? 0} تحسين يمكن مراجعته خلال دقائق.</Typography>
        </Box>
        <Stack spacing={1} alignItems={{ sm: 'flex-end' }}>
          <Chip color="warning" label={`${audit?.autoFixableIssues ?? 0} قابل للإصلاح تلقائيًا`} />
          <Button variant="contained" onClick={onAutoFix} disabled={busy}>إصلاح تلقائي الآن</Button>
          <Button variant="text" onClick={onShowIssues}>عرض المشاكل</Button>
        </Stack>
      </Stack>
    </Box>
  );
}

function Checklist({ audit, onAction }: { audit: SeoAuditDetailsResponse | null; onAction: (key: string) => void }) {
  return (
    <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}>
      <Typography fontWeight={900} sx={{ mb: 1 }}>قائمة مهام مبسطة</Typography>
      <Stack spacing={1}>
        {(audit?.checklist ?? []).map((item) => (
          <Stack key={item.key} direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip size="small" color={item.status === 'done' ? 'success' : item.status === 'error' ? 'error' : 'warning'} label={item.status === 'done' ? 'تم' : item.status === 'error' ? 'مهم' : 'تنبيه'} />
              <Typography>{item.label}</Typography>
              <Chip size="small" variant="outlined" label={priorityLabel(item.priority)} />
            </Stack>
            {item.action ? <Button size="small" onClick={() => onAction(item.key)}>{item.action}</Button> : null}
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

function GooglePreview({ title, description, titleAdvice, descriptionAdvice }: { title: string; description: string; titleAdvice: LengthAdvice; descriptionAdvice: LengthAdvice }) {
  return (
    <Box sx={{ p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper', alignSelf: 'start' }}>
      <Typography fontWeight={900} sx={{ mb: 1 }}>معاينة Google</Typography>
      <Typography color="primary" fontWeight={800}>{title}</Typography>
      <Typography variant="body2" color="success.main" dir="ltr">https://store.example/</Typography>
      <Typography variant="body2" color="text.secondary">{description}</Typography>
      <Divider sx={{ my: 2 }} />
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Chip label={`العنوان: ${title.length} / 70`} color={titleAdvice.color} />
        <Chip label={titleAdvice.label} color={titleAdvice.color} variant="outlined" />
        <Chip label={`الوصف: ${description.length} / 170`} color={descriptionAdvice.color} />
        <Chip label={descriptionAdvice.label} color={descriptionAdvice.color} variant="outlined" />
      </Stack>
    </Box>
  );
}

function IssueList({ issues, onFix }: { issues: SeoIssue[]; onFix: (issue: SeoIssue) => void }) {
  if (!issues.length) return <Alert severity="success">لا توجد مشاكل ضمن هذا الفلتر.</Alert>;
  return (
    <Box sx={{ display: 'grid', gap: 1.5 }}>
      {issues.map((issue) => (
        <Box key={issue.id} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
            <Box>
              <Typography fontWeight={900}>{issue.title}</Typography>
              <Typography variant="body2" color="text.secondary">{targetTypeLabel(issue.targetType)} · {issue.targetName ?? issue.targetTitle ?? 'بدون اسم'} · {issue.issueType}</Typography>
              <Typography variant="body2" color="text.secondary">{issue.description}</Typography>
              {issue.impact ? <Typography variant="body2" color="text.secondary">التأثير: {issue.impact}</Typography> : null}
              {issue.fixMethod ? <Typography variant="body2" color="text.secondary">الإصلاح: {issue.fixMethod}</Typography> : null}
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip size="small" color={severityColor(issue.severity)} label={severityLabel(issue.severity)} />
              {issue.canAutoFix ? <Button variant="outlined" onClick={() => onFix(issue)}>إصلاح هذه المشكلة</Button> : null}
            </Stack>
          </Stack>
        </Box>
      ))}
    </Box>
  );
}

function ShareImage({ settings, uploading, onUpload }: { settings: StoreSeoSettings; uploading: boolean; onUpload: () => void }) {
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
      <Box sx={{ width: 190, aspectRatio: '1.91 / 1', border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {settings.defaultOgImage ? <Box component="img" src={settings.defaultOgImage} alt="صورة المشاركة" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Typography variant="caption" color="text.secondary">لا توجد صورة</Typography>}
      </Box>
      <Stack spacing={1}>
        <Button variant="outlined" onClick={onUpload} disabled={uploading}>{uploading ? 'جاري الرفع...' : 'رفع صورة تظهر عند مشاركة رابط المتجر'}</Button>
        <Typography variant="caption" color="text.secondary" dir="ltr">{settings.defaultOgImage ?? 'لم يتم اختيار صورة بعد'}</Typography>
      </Stack>
    </Stack>
  );
}

function IntegrationStatus({ label, connected }: { label: string; connected: boolean }) {
  return <Chip color={connected ? 'success' : 'default'} label={`${label}: ${connected ? 'مربوط' : 'غير مربوط'}`} sx={{ alignSelf: 'flex-start' }} />;
}

interface LengthAdvice {
  label: string;
  color: 'success' | 'warning' | 'error';
}

function lengthAdvice(value: string, min: number, max: number): LengthAdvice {
  const length = value.trim().length;
  if (!length) return { label: 'غير مكتمل', color: 'error' };
  if (length < min) return { label: 'قصير جدًا', color: 'warning' };
  if (length > max) return { label: 'طويل جدًا', color: 'warning' };
  return { label: 'ممتاز', color: 'success' };
}

function mapSeoSettingsFieldErrors(fieldErrors: Record<string, string[]>): Record<string, string> {
  return mapFieldErrors(fieldErrors, {
    homeSeoTitleAr: ['homeSeoTitleAr'],
    homeSeoTitleEn: ['homeSeoTitleEn'],
    homeSeoDescriptionAr: ['homeSeoDescriptionAr'],
    homeSeoDescriptionEn: ['homeSeoDescriptionEn'],
    defaultSeoTitleAr: ['defaultSeoTitleAr'],
    defaultSeoDescriptionAr: ['defaultSeoDescriptionAr'],
    defaultOgImage: ['defaultOgImage'],
    defaultTwitterImage: ['defaultTwitterImage'],
    keywords: ['keywords'],
    googleSiteVerification: ['googleSiteVerification'],
    googleAnalyticsMeasurementId: ['googleAnalyticsMeasurementId'],
    bingSiteVerification: ['bingSiteVerification'],
    facebookDomainVerification: ['facebookDomainVerification'],
    canonicalBaseUrl: ['canonicalBaseUrl'],
    defaultLanguage: ['defaultLanguage'],
  });
}

function filterIssues(issues: SeoIssue[], filter: IssueFilter): SeoIssue[] {
  if (filter === 'all') return issues;
  if (filter === 'critical') return issues.filter((issue) => issue.severity === 'critical' || issue.severity === 'high');
  if (filter === 'auto') return issues.filter((issue) => issue.canAutoFix);
  return issues.filter((issue) => issue.targetType === filter);
}

function scopeForIssue(issue: SeoIssue): 'home' | 'products' | 'categories' | 'pages' {
  if (issue.targetType === 'product') return 'products';
  if (issue.targetType === 'category') return 'categories';
  if (issue.targetType === 'page') return 'pages';
  return 'home';
}

function targetTypeLabel(type: SeoIssue['targetType']): string {
  if (type === 'product') return 'منتج';
  if (type === 'category') return 'تصنيف';
  if (type === 'page') return 'صفحة';
  if (type === 'integration') return 'ربط خارجي';
  return 'الصفحة الرئيسية';
}

function severityLabel(value: SeoIssue['severity']): string {
  if (value === 'critical') return 'حرجة';
  if (value === 'high') return 'عالية';
  if (value === 'medium' || value === 'warning') return 'متوسطة';
  if (value === 'low') return 'منخفضة';
  if (value === 'info') return 'معلومة';
  if (value === 'warning') return 'تنبيه';
  return 'تحسين';
}

function severityColor(value: SeoIssue['severity']): 'error' | 'warning' | 'info' | 'default' {
  if (value === 'critical' || value === 'high') return 'error';
  if (value === 'medium' || value === 'warning') return 'warning';
  if (value === 'low' || value === 'info') return 'info';
  return 'default';
}

function priorityLabel(value: 'high' | 'medium' | 'low'): string {
  if (value === 'high') return 'أولوية عالية';
  if (value === 'medium') return 'أولوية متوسطة';
  return 'أولوية منخفضة';
}

async function uploadMediaAsset(request: MerchantRequester, file: File): Promise<MediaAsset> {
  const presigned = await request<PresignedMediaUpload>('/media/presign-upload', {
    method: 'POST',
    body: JSON.stringify({ fileName: file.name, contentType: file.type, fileSizeBytes: file.size }),
  });
  if (!presigned) throw new Error('تعذر إنشاء رابط رفع الصورة');
  const uploadResponse = await fetch(presigned.uploadUrl, { method: 'PUT', headers: presigned.uploadHeaders, body: file });
  if (!uploadResponse.ok) throw new Error('فشل رفع الصورة');
  const mediaAsset = await request<MediaAsset>('/media/confirm', {
    method: 'POST',
    body: JSON.stringify({
      objectKey: presigned.objectKey,
      fileName: file.name,
      contentType: file.type,
      fileSizeBytes: file.size,
      etag: uploadResponse.headers.get('etag') ?? undefined,
    }),
  });
  if (!mediaAsset) throw new Error('تعذر حفظ مسار الصورة بعد الرفع');
  return mediaAsset;
}


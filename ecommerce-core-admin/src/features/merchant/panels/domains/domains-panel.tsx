import {
  AddIcon,
  CheckCircleIcon,
  ContentCopyIcon,
  DeleteOutlineIcon,
  LanguageIcon,
  SyncIcon,
  WarningAmberIcon,
} from '../../../../components/icons';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  MenuItem,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import type { MerchantRequester } from '../../merchant-dashboard.types';
import type { CompleteDomainSetupResponse, Domain, DomainDnsRecord } from '../../types';
import { AppPage, DataTableWrapper, FloatingActionButton, PageHeader, SectionCard } from '../../components/ui';
import { clearFieldErrors, isApiError, mapFieldErrors } from '../../../../lib/api-error';

interface DomainsPanelProps {
  request: MerchantRequester;
}

type MessageState = { text: string; type: 'info' | 'success' | 'error' };

const DNS_PROVIDERS = ['Cloudflare', 'Hostinger', 'GoDaddy', 'Namecheap', 'أخرى'];
const SETUP_STEPS = ['أدخل النطاق', 'أضف سجلات DNS', 'تحقق من الربط', 'إصدار SSL', 'تم الربط'];

export function DomainsPanel({ request }: DomainsPanelProps) {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [hostname, setHostname] = useState('');
  const [dnsProvider, setDnsProvider] = useState<string>(DNS_PROVIDERS[0] ?? 'Cloudflare');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<MessageState>({ text: '', type: 'info' });

  const normalizedHostname = useMemo(() => normalizeHostname(hostname), [hostname]);

  useEffect(() => {
    loadDomains().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadDomains(): Promise<void> {
    setLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      const data = await request<Domain[]>('/domains', { method: 'GET' });
      setDomains(data ?? []);
    } catch (error) {
      setMessage({ text: toFriendlyError(error, 'تعذر تحميل النطاقات'), type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function createDomain(): Promise<void> {
    if (!normalizedHostname) {
      setFieldErrors({ hostname: 'اسم النطاق مطلوب' });
      setMessage({ text: 'اسم النطاق مطلوب', type: 'error' });
      return;
    }

    setActionLoading('create');
    setMessage({ text: '', type: 'info' });
    setFieldErrors({});
    try {
      await request('/domains', {
        method: 'POST',
        body: JSON.stringify({ hostname: normalizedHostname }),
      });
      setHostname('');
      await loadDomains();
      setMessage({ text: 'تمت إضافة النطاق. أضف سجلات DNS ثم اضغط تحقق وإكمال الربط.', type: 'success' });
    } catch (error) {
      if (isApiError(error)) {
        setFieldErrors(mapDomainFieldErrors(error.fieldErrors));
      }
      setMessage({ text: toFriendlyError(error, 'تعذر إضافة النطاق'), type: 'error' });
    } finally {
      setActionLoading(null);
    }
  }

  async function completeSetup(domainId: string): Promise<void> {
    setActionLoading(domainId);
    setMessage({ text: 'جاري فحص سجلات DNS وتجهيز SSL...', type: 'info' });
    try {
      const updated = await request<CompleteDomainSetupResponse>(`/domains/${domainId}/complete-setup`, {
        method: 'POST',
      });
      if (!updated) {
        throw new Error('Empty domain setup response');
      }
      setDomains((current) => current.map((domain) => (domain.id === domainId ? updated : domain)));
      setMessage({ text: updated.message, type: updated.setupComplete ? 'success' : 'info' });
      await loadDomains();
    } catch (error) {
      setMessage({ text: toFriendlyError(error, 'فشلت عملية التحقق وإكمال الربط'), type: 'error' });
    } finally {
      setActionLoading(null);
    }
  }

  async function deleteDomain(domainId: string): Promise<void> {
    if (!window.confirm('هل أنت متأكد من حذف هذا النطاق نهائيا؟ سيتوقف المتجر عن العمل عليه.')) {
      return;
    }
    setActionLoading(domainId);
    setMessage({ text: '', type: 'info' });
    try {
      await request(`/domains/${domainId}`, { method: 'DELETE' });
      await loadDomains();
      setMessage({ text: 'تم حذف النطاق', type: 'success' });
    } catch (error) {
      setMessage({ text: toFriendlyError(error, 'تعذر حذف النطاق'), type: 'error' });
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <AppPage>
      <PageHeader
        title="النطاقات (الدومين)"
        description="ربط المتجر بنطاق مخصص عبر خطوات واضحة وسجلات DNS قابلة للنسخ."
        actions={
          <Button variant="outlined" startIcon={<SyncIcon />} onClick={() => loadDomains().catch(() => undefined)} disabled={loading}>
            تحديث
          </Button>
        }
      />

      {message.text ? <Alert severity={message.type}>{message.text}</Alert> : null}

      <SectionCard>
        <Stack spacing={3}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <LanguageIcon color="primary" />
            <Typography variant="h6" fontWeight={800}>
              ربط نطاق جديد
            </Typography>
          </Stack>
          <Divider />
          <Stepper activeStep={domains.length > 0 ? Math.min(maxSetupStep(domains[0]!), 4) : 0} alternativeLabel>
            {SETUP_STEPS.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="flex-start">
            <TextField
              size="small"
              fullWidth
              value={hostname}
              error={Boolean(fieldErrors.hostname)}
              onChange={(event) => {
                setFieldErrors((prev) => clearFieldErrors(prev, ['hostname']));
                setHostname(event.target.value);
              }}
              placeholder="https://shop.example.com/"
              label="النطاق"
              dir="ltr"
              helperText={
                fieldErrors.hostname ||
                (normalizedHostname ? `سيتم حفظه كالتالي: ${normalizedHostname}` : ' ')
              }
              sx={{ maxWidth: 420 }}
            />
            <TextField
              size="small"
              select
              value={dnsProvider}
              onChange={(event) => setDnsProvider(event.target.value)}
              label="مزود DNS"
              sx={{ minWidth: 180 }}
            >
              {DNS_PROVIDERS.map((provider) => (
                <MenuItem key={provider} value={provider}>
                  {provider}
                </MenuItem>
              ))}
            </TextField>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => createDomain().catch(() => undefined)}
              disabled={actionLoading === 'create' || !normalizedHostname}
              disableElevation
              sx={{ minWidth: 150 }}
            >
              إضافة النطاق
            </Button>
          </Stack>

          <Alert severity="info">{providerHint(dnsProvider)}</Alert>
          {isLikelyRootDomain(normalizedHostname) ? (
            <Alert severity="warning">
              يبدو أنك أدخلت دومينا رئيسيا. ننصح باستخدام www أو subdomain، ثم تحويل الدومين الرئيسي إليه من مزود النطاق.
            </Alert>
          ) : null}
        </Stack>
      </SectionCard>

      <DataTableWrapper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>النطاق</TableCell>
                <TableCell>الحالة</TableCell>
                <TableCell>سجلات DNS المطلوبة</TableCell>
                <TableCell align="left">الإجراءات</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 6 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : domains.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary">لا توجد نطاقات مخصصة مرتبطة بهذا المتجر.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                domains.map((domain) => (
                  <TableRow key={domain.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                    <TableCell sx={{ minWidth: 220 }}>
                      <Typography variant="subtitle2" fontWeight={800} dir="ltr">
                        {domain.hostname}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        SSL: {formatSslStatus(domain.sslStatus)}
                      </Typography>
                      {domain.rootDomainWarning ? (
                        <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mt: 1, py: 0 }}>
                          {domain.rootDomainWarning}
                        </Alert>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Stack spacing={1}>
                        <Chip
                          size="small"
                          label={formatMerchantStatus(domain)}
                          color={domain.merchantStatus === 'active' ? 'success' : domain.supportRequired ? 'error' : 'warning'}
                          sx={{ fontWeight: 700, width: 'fit-content' }}
                        />
                        {domain.sslError ? (
                          <Typography variant="caption" color="error">
                            {toFriendlyError(domain.sslError, 'يحتاج إعداد SSL إلى مراجعة.')}
                          </Typography>
                        ) : null}
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ minWidth: 560 }}>
                      <DnsRecordsTable records={recordsForDomain(domain)} />
                    </TableCell>
                    <TableCell align="left">
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent="flex-end">
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<CheckCircleIcon />}
                          onClick={() => completeSetup(domain.id).catch(() => undefined)}
                          disabled={actionLoading === domain.id}
                          disableElevation
                        >
                          تحقق وإكمال الربط
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          variant="outlined"
                          startIcon={<DeleteOutlineIcon />}
                          onClick={() => deleteDomain(domain.id).catch(() => undefined)}
                          disabled={actionLoading === domain.id}
                        >
                          حذف
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </DataTableWrapper>

      <FloatingActionButton
        label="إضافة نطاق"
        icon={<AddIcon />}
        onClick={() => createDomain().catch(() => undefined)}
        disabled={actionLoading === 'create' || !normalizedHostname}
      />
    </AppPage>
  );
}

function DnsRecordsTable({ records }: { records: DomainDnsRecord[] }) {
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>الحالة</TableCell>
          <TableCell>النوع</TableCell>
          <TableCell>الاسم</TableCell>
          <TableCell>القيمة</TableCell>
          <TableCell>الغرض</TableCell>
          <TableCell align="left">نسخ</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {records.map((record) => (
          <TableRow key={`${record.type}-${record.name}-${record.value}`}>
            <TableCell>
              <Chip size="small" label={formatRecordStatus(record.status)} color={record.status === 'valid' ? 'success' : 'warning'} />
            </TableCell>
            <TableCell>{record.type}</TableCell>
            <TableCell dir="ltr" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {record.name}
            </TableCell>
            <TableCell dir="ltr" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {record.value}
            </TableCell>
            <TableCell>{formatRecordPurpose(record.purpose)}</TableCell>
            <TableCell align="left">
              <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                <Button size="small" startIcon={<ContentCopyIcon />} onClick={() => copyText(record.name)}>
                  الاسم
                </Button>
                <Button size="small" startIcon={<ContentCopyIcon />} onClick={() => copyText(record.value)}>
                  القيمة
                </Button>
              </Stack>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function recordsForDomain(domain: Domain): DomainDnsRecord[] {
  return domain.records?.length
    ? domain.records
    : [
        {
          type: 'TXT',
          name: domain.verificationDnsHost,
          value: domain.verificationToken,
          purpose: 'ownership',
          required: true,
          status: domain.status === 'pending' ? 'pending' : 'valid',
        },
        {
          type: 'CNAME',
          name: domain.routingHost ?? domain.hostname,
          value: domain.routingTarget ?? 'stores.example.com',
          purpose: 'routing',
          required: true,
          status: domain.status === 'active' ? 'valid' : 'pending',
        },
      ];
}

function normalizeHostname(value: string): string {
  return value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/\.$/, '');
}

function mapDomainFieldErrors(fieldErrors: Record<string, string[]>): Record<string, string> {
  return mapFieldErrors(fieldErrors, {
    hostname: ['hostname', 'domain'],
  });
}

function isLikelyRootDomain(hostname: string): boolean {
  return hostname.split('.').length === 2;
}

function maxSetupStep(domain: Domain): number {
  if (domain.merchantStatus === 'active') return 4;
  if (domain.merchantStatus === 'issuing_ssl') return 3;
  if (domain.status === 'verified') return 2;
  return 1;
}

function formatMerchantStatus(domain: Domain): string {
  switch (domain.merchantStatus) {
    case 'active':
      return 'نشط';
    case 'issuing_ssl':
      return 'جاري إصدار SSL';
    case 'verified':
      return 'تم التحقق';
    case 'support_required':
      return 'يحتاج تدخل الدعم';
    case 'dns_error':
      return 'يوجد خطأ في DNS';
    default:
      return 'بانتظار إعداد DNS';
  }
}

function formatSslStatus(status: Domain['sslStatus']): string {
  if (status === 'issued') return 'صادر';
  if (status === 'requested') return 'قيد الإصدار';
  if (status === 'error') return 'يحتاج مراجعة';
  return 'بانتظار التحقق';
}

function formatRecordStatus(status: DomainDnsRecord['status']): string {
  if (status === 'valid') return 'صحيح';
  if (status === 'missing') return 'غير موجود';
  if (status === 'wrong_value') return 'قيمة غير صحيحة';
  if (status === 'error') return 'تعذر الفحص';
  return 'بانتظار';
}

function formatRecordPurpose(purpose: DomainDnsRecord['purpose']): string {
  if (purpose === 'routing') return 'توجيه المتجر';
  if (purpose === 'ownership') return 'إثبات الملكية';
  if (purpose === 'cloudflare_ownership') return 'تحقق Cloudflare';
  return 'شهادة SSL';
}

function providerHint(provider: string): string {
  if (provider === 'Hostinger') return 'في Hostinger افتح DNS Zone Editor ثم أضف سجلات CNAME و TXT بالقيم الظاهرة.';
  if (provider === 'Cloudflare') return 'في Cloudflare افتح DNS ثم Records. اجعل سجل نطاقك DNS Only إذا كان داخل حسابك.';
  if (provider === 'GoDaddy') return 'في GoDaddy افتح DNS Management ثم أضف السجلات المطلوبة، وقد يستغرق الانتشار عدة دقائق.';
  if (provider === 'Namecheap') return 'في Namecheap افتح Advanced DNS ثم أضف CNAME و TXT كما هو ظاهر في الجدول.';
  return 'أضف السجلات المطلوبة من لوحة DNS لدى مزود الدومين، ثم اضغط تحقق وإكمال الربط.';
}

function toFriendlyError(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : String(error || '');
  if (!raw) return fallback;
  if (raw.includes('Cloudflare custom hostname id')) {
    return 'لم يتم إنشاء شهادة SSL بعد. اضغط "تحقق وإكمال الربط" أو انتظر قليلا.';
  }
  if (raw.toLowerCase().includes('fallback origin')) {
    return 'إعدادات النطاقات المخصصة غير مكتملة من طرف المنصة. تواصل مع الدعم.';
  }
  if (raw.toLowerCase().includes('cloudflare api request failed')) {
    return 'تعذر تجهيز SSL من مزود الخدمة. يرجى المحاولة لاحقا أو التواصل مع الدعم.';
  }
  return raw;
}

function copyText(value: string): void {
  navigator.clipboard?.writeText(value).catch(() => undefined);
}


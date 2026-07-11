import {
  CheckCircleIcon,
  CloudUploadIcon,
  ImageIcon,
  PaletteIcon,
  ReplayOutlinedIcon,
  RocketLaunchIcon,
  SaveIcon,
  StorefrontIcon,
  UndoIcon,
  VisibilityIcon,
} from '../../../../components/icons';
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControlLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';

import type { MerchantRequester } from '../../merchant-dashboard.types';
import { KaleemLoader } from '../../components/ui';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import type { Category, MediaAsset, PresignedMediaUpload, ProductListResponse, PreviewTokenResponse, ThemeState, ThemeTemplate, ThemeTemplateListResponse } from '../../types';
import { themeT } from './theme-i18n';

interface ThemesPanelProps {
  request: MerchantRequester;
  apiBaseUrl: string;
}

type MessageState = { text: string; type: 'info' | 'success' | 'error' };
type ConfirmState = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  variant?: 'default' | 'danger' | 'warning';
  action: (() => void | Promise<void>) | null;
};
type SettingsDraft = Record<string, unknown>;
type FieldType = 'text' | 'textarea' | 'image' | 'url' | 'number' | 'boolean' | 'select' | 'color';
type ThemeTab = 'templates' | 'identity' | 'home' | 'shell' | 'publish';
type HomeSectionType =
  | 'hero'
  | 'categories'
  | 'products'
  | 'promoBanners'
  | 'brands'
  | 'storeStory'
  | 'trustBadges'
  | 'contactStrip'
  | 'newsletter'
  | 'customContent';

const SUPPORTED_THEME_FONTS = ['Cairo', 'Tajawal', 'Alexandria', 'IBM Plex Sans Arabic', 'Noto Kufi Arabic', 'Noto Sans Arabic', 'Inter', 'Arial'];

interface HomeSection {
  id: string;
  type: HomeSectionType;
  variant: string;
  enabled: boolean;
  locked?: boolean;
  settings: Record<string, unknown>;
  source?: Record<string, unknown>;
}

interface HomeSectionDefinition {
  type: HomeSectionType;
  label: string;
  description: string;
  variants: string[];
  defaultVariant: string;
  sourceTypes: string[];
  defaultSettings: Record<string, unknown>;
  defaultSource?: Record<string, unknown>;
  locked?: boolean;
  repeatable?: boolean;
}

interface AccessibilityAudit {
  score: number;
  wcagLevel: 'AA';
  issues: Array<{ code: string; severity: 'critical' | 'warning'; message: string; path: string }>;
}

interface SchemaField {
  key?: string;
  type?: FieldType;
  label?: string;
  default?: unknown;
  maxLength?: number;
  min?: number;
  max?: number;
  options?: Array<{ value: string; label: string } | string>;
}

interface ThemeDesignResponse {
  design: Record<string, unknown>;
  source: 'draft' | 'default';
  hasUnpublishedChanges: boolean;
  contrast: ContrastItem[];
}

interface DesignPreset {
  key: string;
  name: string;
  category: string;
  design: Record<string, unknown>;
  preview: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
  };
}

interface DesignPresetListResponse {
  items: DesignPreset[];
}

interface ContrastItem {
  pair: string;
  ratio: number | null;
  status: 'pass' | 'warning' | 'fail';
}

const DEFAULT_STOREFRONT_URL_PATTERN = 'https://{storeSlug}.kaleemstores.com';
const COLOR_PRESETS = ['#0f766e', '#2563eb', '#7c3aed', '#dc2626', '#ea580c', '#16a34a', '#111827'];
const MAX_SECTIONS = 24;
const MAX_REPEATER_ITEMS = 12;
const SUPPORTED_SOURCE_TYPES = ['manual', 'featured', 'latest', 'category', 'selectedProducts', 'selectedCategories'];
const SAFE_TRUST_BADGE_ICONS = ['shield', 'truck', 'support', 'star', 'check', 'credit-card', 'package'];
const SECTION_VARIANT_ALLOWLIST: Partial<Record<HomeSectionType, string[]>> = {
  hero: ['split', 'centered', 'banner'],
  products: ['grid', 'compact'],
  categories: ['cards', 'grid'],
  promoBanners: ['single', 'twoColumns'],
};

export function ThemesPanel({ request, apiBaseUrl }: ThemesPanelProps) {
  const [themeState, setThemeState] = useState<ThemeState | null>(null);
  const [templates, setTemplates] = useState<ThemeTemplate[]>([]);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('');
  const [settingsDraft, setSettingsDraft] = useState<SettingsDraft>({});
  const [activeTab, setActiveTab] = useState<ThemeTab>('templates');
  const [designDraft, setDesignDraft] = useState<Record<string, unknown>>({});
  const [homeSections, setHomeSections] = useState<HomeSection[]>([]);
  const [sectionRegistry, setSectionRegistry] = useState<HomeSectionDefinition[]>([]);
  const [designPresets, setDesignPresets] = useState<DesignPreset[]>([]);
  const [contrastItems, setContrastItems] = useState<ContrastItem[]>([]);
  const [storeSlug, setStoreSlug] = useState<string | null>(null);
  const [previewToken, setPreviewToken] = useState<PreviewTokenResponse | null>(null);
  const [accessibilityAudit, setAccessibilityAudit] = useState<AccessibilityAudit | null>(null);
  const [loading, setLoading] = useState(true);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<MessageState>({ text: '', type: 'info' });
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    open: false,
    title: '',
    description: '',
    action: null,
  });

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.templateKey === selectedTemplateKey) ?? null,
    [selectedTemplateKey, templates],
  );
  const storefrontBaseUrl = resolveStorefrontBaseUrl(apiBaseUrl, storeSlug);
  const currentConfig = useMemo(
    () => {
      const config = buildComponentConfig(selectedTemplate, themeState?.draftConfig, settingsDraft);
      const pages = asRecord(config.pages);
      const home = asRecord(pages.home);
      return {
        ...config,
        design: sanitizeDesignDraft(designDraft),
        pages: {
          ...pages,
          home: {
            ...home,
            sections: sanitizeHomeSections(homeSections, sectionRegistry),
          },
        },
      };
    },
    [designDraft, homeSections, sectionRegistry, selectedTemplate, settingsDraft, themeState?.draftConfig],
  );
  const isDraftPublished = useMemo(
    () => JSON.stringify(themeState?.draftConfig ?? {}) === JSON.stringify(themeState?.publishedConfig ?? {}),
    [themeState],
  );

  const loadInitialState = useCallback(async (): Promise<void> => {
    setLoading(true);
    setTemplatesLoading(true);
    try {
      const [draft, templateList, storeSettings] = await Promise.all([
        request<ThemeState>('/themes/draft', { method: 'GET' }),
        request<ThemeTemplateListResponse>('/themes/templates', { method: 'GET' }),
        request<{ slug?: string }>('/store/settings', { method: 'GET' }).catch(() => null),
      ]);
      const [design, presets, registry] = await Promise.all([
        request<ThemeDesignResponse>('/themes/current/design', { method: 'GET' }).catch(() => null),
        request<DesignPresetListResponse>('/themes/design-presets', { method: 'GET' }).catch(() => null),
        request<{ items: HomeSectionDefinition[] }>('/themes/section-registry', { method: 'GET' }).catch(() => ({ items: [] })),
      ]);

      const items = (templateList?.items ?? []).filter(isMerchantVisibleTemplate);
      const sanitizedRegistry = (registry?.items ?? [])
        .filter((item) => item.type !== 'brands')
        .map(sanitizeSectionDefinition)
        .filter((item) => item.sourceTypes.length > 0);
      setTemplates(items);
      setThemeState(draft);
      setStoreSlug(typeof storeSettings?.slug === 'string' ? storeSettings.slug : null);

      const draftTemplateKey = readTemplateKey(draft?.draftConfig);
      const initialTemplate = items.find((template) => template.templateKey === draftTemplateKey) ?? items[0] ?? null;
      setSelectedTemplateKey(initialTemplate?.templateKey ?? '');
      setSettingsDraft(readConfigDraft(draft?.draftConfig ?? initialTemplate?.defaultConfig ?? {}));
      setDesignDraft(design?.design ?? resolveDesignFromConfig(draft?.draftConfig ?? initialTemplate?.defaultConfig ?? {}));
      setHomeSections(readHomeSections(draft?.draftConfig ?? initialTemplate?.defaultConfig ?? {}));
      setContrastItems(design?.contrast ?? []);
      setDesignPresets(presets?.items ?? []);
      setSectionRegistry(sanitizedRegistry);
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : themeT('themes.error.load'), type: 'error' });
    } finally {
      setLoading(false);
      setTemplatesLoading(false);
    }
  }, [request]);

  useEffect(() => {
    void loadInitialState();
  }, [loadInitialState]);

  function requestConfirm(next: Omit<ConfirmState, 'open'>): void {
    setConfirmState({ ...next, open: true });
  }

  function closeConfirm(): void {
    if (actionLoading) return;
    setConfirmState((current) => ({ ...current, open: false, action: null }));
  }

  async function runConfirmedAction(): Promise<void> {
    const action = confirmState.action;
    if (!action) return;
    await action();
    setConfirmState((current) => ({ ...current, open: false, action: null }));
  }

  function selectTemplate(template: ThemeTemplate): void {
    setSelectedTemplateKey(template.templateKey);
    const sourceConfig =
      readTemplateKey(themeState?.draftConfig) === template.templateKey
        ? themeState?.draftConfig
        : template.defaultConfig;
    setSettingsDraft(readConfigDraft(sourceConfig ?? {}));
    setDesignDraft(resolveDesignFromConfig(sourceConfig ?? {}));
    setHomeSections(readHomeSections(sourceConfig ?? {}));
    setMessage({ text: '', type: 'info' });
  }

  async function applyTemplate(template: ThemeTemplate, publish = false): Promise<void> {
    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      const endpoint = publish ? '/themes/apply-template-and-publish' : '/themes/apply-template';
      const response = await request<ThemeState | { ok: true }>(endpoint, {
        method: 'POST',
        body: JSON.stringify({ templateKey: template.templateKey }),
      });

      if (!publish && response && 'draftConfig' in response) {
        setThemeState(response);
        setSettingsDraft(readConfigDraft(response.draftConfig));
        setDesignDraft(resolveDesignFromConfig(response.draftConfig));
        setHomeSections(readHomeSections(response.draftConfig));
      } else {
        await refreshDraft();
      }

      setSelectedTemplateKey(template.templateKey);
      setMessage({
        text: publish ? themeT('themes.success.applyPublish') : themeT('themes.success.applyDraft'),
        type: 'success',
      });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : themeT('themes.error.applyTemplate'), type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  async function saveDraft(): Promise<void> {
    if (!selectedTemplate) return;
    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      const data = await request<ThemeState>('/themes/draft', {
        method: 'PUT',
        body: JSON.stringify({ config: currentConfig }),
      });
      if (data) setThemeState(data);
      setMessage({ text: themeT('themes.success.saveDraft'), type: 'success' });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : themeT('themes.error.saveDraft'), type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  async function publishDraft(): Promise<void> {
    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      await request<ThemeState>('/themes/draft', {
        method: 'PUT',
        body: JSON.stringify({ config: currentConfig }),
      });
      const audit = await request<AccessibilityAudit>('/themes/current/accessibility/audit', {
        method: 'POST',
      });
      setAccessibilityAudit(audit);
      if (audit?.issues.some((issue) => issue.severity === 'critical')) {
        setMessage({ text: 'لا يمكن النشر قبل إصلاح مشاكل التباين الحرجة في القالب.', type: 'error' });
        return;
      }
      const data = await request<ThemeState>('/themes/publish', { method: 'POST' });
      if (data) setThemeState(data);
      setMessage({ text: themeT('themes.success.publish'), type: 'success' });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : themeT('themes.error.publish'), type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  async function createPreviewToken(): Promise<void> {
    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      await request<ThemeState>('/themes/draft', {
        method: 'PUT',
        body: JSON.stringify({ config: currentConfig }),
      });
      const token = await request<PreviewTokenResponse>('/themes/preview-token', {
        method: 'POST',
        body: JSON.stringify({ expiresInMinutes: 30 }),
      });
      setPreviewToken(token);
      setMessage({ text: themeT('themes.success.preview'), type: 'success' });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : themeT('themes.error.preview'), type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  async function restorePublished(): Promise<void> {
    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      const data = await request<ThemeState>('/themes/current/restore-published', { method: 'POST' });
      if (data) {
        setThemeState(data);
        setSettingsDraft(readConfigDraft(data.draftConfig));
        setDesignDraft(resolveDesignFromConfig(data.draftConfig));
        setHomeSections(readHomeSections(data.draftConfig));
      }
      setMessage({ text: themeT('themes.success.restorePublished'), type: 'success' });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : themeT('themes.error.restorePublished'), type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  async function resetTemplate(): Promise<void> {
    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      const data = await request<ThemeState>('/themes/current/reset-template', { method: 'POST' });
      if (data) {
        setThemeState(data);
        setSettingsDraft(readConfigDraft(data.draftConfig));
        setDesignDraft(resolveDesignFromConfig(data.draftConfig));
        setHomeSections(readHomeSections(data.draftConfig));
      }
      setMessage({ text: themeT('themes.success.resetTemplate'), type: 'success' });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : themeT('themes.error.resetTemplate'), type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  async function saveHomePageDraft(nextSections = homeSections): Promise<void> {
    const safeSections = sanitizeHomeSections(nextSections, sectionRegistry);
    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      const data = await request<ThemeState>('/themes/current/home', {
        method: 'PUT',
        body: JSON.stringify({ sections: safeSections }),
      });
      if (data) {
        setThemeState(data);
        setSettingsDraft(readConfigDraft(data.draftConfig));
        setDesignDraft(resolveDesignFromConfig(data.draftConfig));
        setHomeSections(readHomeSections(data.draftConfig));
      }
      setMessage({ text: themeT('themes.success.saveHome'), type: 'success' });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : themeT('themes.error.saveHome'), type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  async function resetHomePage(): Promise<void> {
    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      const data = await request<ThemeState>('/themes/current/home/reset', { method: 'POST' });
      if (data) {
        setThemeState(data);
        setHomeSections(readHomeSections(data.draftConfig));
      }
      setMessage({ text: themeT('themes.success.resetHome'), type: 'success' });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : themeT('themes.error.resetHome'), type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  async function restorePublishedHomePage(): Promise<void> {
    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      const data = await request<ThemeState>('/themes/current/home/restore-published', { method: 'POST' });
      if (data) {
        setThemeState(data);
        setHomeSections(readHomeSections(data.draftConfig));
      }
      setMessage({ text: themeT('themes.success.restoreHome'), type: 'success' });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : themeT('themes.error.restoreHome'), type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  async function saveDesignDraft(nextDesign = designDraft): Promise<void> {
    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      const data = await request<ThemeState>('/themes/current/design', {
        method: 'PATCH',
        body: JSON.stringify({ design: nextDesign }),
      });
      if (data) {
        setThemeState(data);
        setDesignDraft(resolveDesignFromConfig(data.draftConfig));
      }
      await refreshDesign();
      setMessage({ text: themeT('themes.success.saveDesign'), type: 'success' });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : themeT('themes.error.saveDesign'), type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  async function applyDesignPreset(presetKey: string): Promise<void> {
    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      const data = await request<ThemeState>('/themes/current/design/apply-preset', {
        method: 'POST',
        body: JSON.stringify({ presetKey }),
      });
      if (data) {
        setThemeState(data);
        setDesignDraft(resolveDesignFromConfig(data.draftConfig));
      }
      await refreshDesign();
      setMessage({ text: themeT('themes.success.applyPreset'), type: 'success' });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : themeT('themes.error.applyPreset'), type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  async function resetDesign(): Promise<void> {
    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      const data = await request<ThemeState>('/themes/current/design/reset', { method: 'POST' });
      if (data) {
        setThemeState(data);
        setDesignDraft(resolveDesignFromConfig(data.draftConfig));
      }
      await refreshDesign();
      setMessage({ text: themeT('themes.success.resetDesign'), type: 'success' });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : themeT('themes.error.resetDesign'), type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  async function restoreDesign(): Promise<void> {
    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      const data = await request<ThemeState>('/themes/current/design/restore-published', { method: 'POST' });
      if (data) {
        setThemeState(data);
        setDesignDraft(resolveDesignFromConfig(data.draftConfig));
      }
      await refreshDesign();
      setMessage({ text: themeT('themes.success.restoreDesign'), type: 'success' });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : themeT('themes.error.restoreDesign'), type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  async function refreshDraft(): Promise<void> {
    const data = await request<ThemeState>('/themes/draft', { method: 'GET' });
    if (data) {
      setThemeState(data);
      setSettingsDraft(readConfigDraft(data.draftConfig));
      setDesignDraft(resolveDesignFromConfig(data.draftConfig));
      setHomeSections(readHomeSections(data.draftConfig));
    }
  }

  async function refreshDesign(): Promise<void> {
    const data = await request<ThemeDesignResponse>('/themes/current/design', { method: 'GET' });
    if (data) {
      setDesignDraft(data.design);
      setContrastItems(data.contrast);
    }
  }

  if (loading) {
    return <KaleemLoader label="جاري تحميل قوالب المتجر" />;
  }

  return (
    <Stack spacing={2.5} dir="rtl">
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>قوالب واجهة المتجر</Typography>
          <Typography color="text.secondary">اختر قالباً جاهزاً، عدّل إعداداته، ثم انشره مباشرة على الدومين.</Typography>
        </Box>
        <Stack direction="row" gap={1} flexWrap="wrap">
          <Button startIcon={<VisibilityIcon />} variant="outlined" disabled={!selectedTemplate || actionLoading} onClick={() => createPreviewToken().catch(() => undefined)}>
            معاينة
          </Button>
          <Button startIcon={<SaveIcon />} variant="outlined" disabled={!selectedTemplate || actionLoading} onClick={() => saveDraft().catch(() => undefined)}>
            حفظ المسودة
          </Button>
          <Button
            startIcon={<RocketLaunchIcon />}
            variant="contained"
            disabled={!selectedTemplate || actionLoading}
            onClick={() => requestConfirm({
              title: themeT('themes.confirm.publishTitle'),
              description: themeT('themes.confirm.publishMessage'),
              confirmLabel: themeT('themes.actions.publish'),
              variant: 'warning',
              action: publishDraft,
            })}
          >
            نشر
          </Button>
        </Stack>
      </Stack>

      {actionLoading ? <LinearProgress /> : null}
      {message.text ? <Alert severity={message.type}>{message.text}</Alert> : null}
      {accessibilityAudit ? (
        <Alert severity={accessibilityAudit.issues.some((issue) => issue.severity === 'critical') ? 'error' : 'info'}>
          Accessibility score: {accessibilityAudit.score}/100.{' '}
          {accessibilityAudit.issues.length === 0
            ? 'No contrast issues found.'
            : `${accessibilityAudit.issues.length} contrast issue(s) need review.`}
        </Alert>
      ) : null}
      {previewToken ? (
        <Alert
          severity="info"
          action={
            <Button href={buildPreviewUrl(storefrontBaseUrl, previewToken.previewToken, storeSlug)} target="_blank" rel="noreferrer" size="small">
              فتح
            </Button>
          }
        >
          رابط المعاينة صالح حتى {new Date(previewToken.expiresAt).toLocaleString('ar')}
        </Alert>
      ) : null}

      <ThemeStatusCard
        themeState={themeState}
        selectedTemplate={selectedTemplate}
        isDraftPublished={isDraftPublished}
        onPreview={() => createPreviewToken().catch(() => undefined)}
        onSave={() => saveDraft().catch(() => undefined)}
        onPublish={() => requestConfirm({
          title: themeT('themes.confirm.publishTitle'),
          description: themeT('themes.confirm.publishMessage'),
          confirmLabel: themeT('themes.actions.publish'),
          variant: 'warning',
          action: publishDraft,
        })}
        disabled={actionLoading || !selectedTemplate}
      />

      <Paper variant="outlined" sx={{ borderRadius: 2 }}>
        <Tabs
          value={activeTab}
          onChange={(_, value: ThemeTab) => setActiveTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ px: 1, borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab value="templates" label="القوالب" />
          <Tab value="identity" label="الهوية" />
          <Tab value="home" label="الصفحة الرئيسية" />
          <Tab value="shell" label="الهيدر والفوتر" />
          <Tab value="publish" label="المعاينة والنشر" />
        </Tabs>
      </Paper>

      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2.5} alignItems="stretch" sx={{ display: activeTab === 'templates' ? 'flex' : 'none' }}>
        <Paper variant="outlined" sx={{ p: 2, flex: 1.15, borderRadius: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6" sx={{ fontWeight: 900 }}>القوالب المتاحة</Typography>
            <Chip size="small" label={`${templates.length} قالب`} />
          </Stack>
          {templatesLoading ? <LinearProgress /> : null}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 1.5 }}>
            {templates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                selected={template.templateKey === selectedTemplateKey}
                onSelect={() => selectTemplate(template)}
                onApply={() => requestConfirm({
                  title: themeT('themes.confirm.applyDraftTitle'),
                  description: themeT('themes.confirm.applyDraftMessage'),
                  confirmLabel: themeT('themes.actions.applyDraft'),
                  variant: 'warning',
                  action: () => applyTemplate(template, false),
                })}
                onApplyAndPublish={() => requestConfirm({
                  title: themeT('themes.confirm.applyPublishTitle'),
                  description: themeT('themes.confirm.applyPublishMessage'),
                  confirmLabel: themeT('themes.actions.applyPublish'),
                  variant: 'warning',
                  action: () => applyTemplate(template, true),
                })}
                disabled={actionLoading}
              />
            ))}
          </Box>
          {templates.length === 0 && !templatesLoading ? (
            <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>لا توجد قوالب منشورة من المنصة حتى الآن.</Box>
          ) : null}
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, flex: 0.85, borderRadius: 2 }}>
          <Stack spacing={1.5}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 900 }}>إعدادات القالب</Typography>
                <Typography variant="body2" color="text.secondary">{selectedTemplate?.name ?? 'اختر قالباً لتعديل إعداداته'}</Typography>
              </Box>
              {isDraftPublished ? <Chip size="small" color="success" label="منشور" /> : <Chip size="small" color="warning" label="مسودة" />}
            </Stack>
            <Divider />
            {selectedTemplate ? (
              <SettingsEditor
                schema={selectedTemplate?.settingsSchema ?? {}}
                values={settingsDraft}
                request={request}
                onChange={(key, value) => setSettingsDraft((current) => setByPath(current, normalizeConfigPath(key), value))}
              />
            ) : (
              <Typography color="text.secondary">لا توجد إعدادات قابلة للتعديل.</Typography>
            )}
          </Stack>
        </Paper>
      </Stack>

      {activeTab === 'identity' ? (
        <IdentityPanel
          design={designDraft}
          presets={designPresets}
          contrastItems={contrastItems}
          disabled={actionLoading}
          onChange={(path, value) => setDesignDraft((current) => setByPath(current, path, value))}
          onApplyPreset={(presetKey) => requestConfirm({
            title: themeT('themes.confirm.applyPresetTitle'),
            description: themeT('themes.confirm.applyPresetMessage'),
            confirmLabel: themeT('themes.actions.confirm'),
            variant: 'warning',
            action: () => applyDesignPreset(presetKey),
          })}
          onSave={() => saveDesignDraft().catch(() => undefined)}
          onReset={() => requestConfirm({
            title: themeT('themes.confirm.resetDesignTitle'),
            description: themeT('themes.confirm.resetDesignMessage'),
            confirmLabel: themeT('themes.actions.reset'),
            variant: 'warning',
            action: resetDesign,
          })}
          onRestore={() => requestConfirm({
            title: themeT('themes.confirm.restoreDesignTitle'),
            description: themeT('themes.confirm.restoreDesignMessage'),
            confirmLabel: themeT('themes.identity.restorePublished'),
            variant: 'warning',
            action: restoreDesign,
          })}
        />
      ) : null}

      {activeTab === 'home' ? (
        <HomePageComposerPanel
          request={request}
          sections={homeSections}
          registry={sectionRegistry}
          disabled={actionLoading}
          onChange={setHomeSections}
          onSave={() => saveHomePageDraft().catch(() => undefined)}
          onReset={() => requestConfirm({
            title: themeT('themes.confirm.resetHomeTitle'),
            description: themeT('themes.confirm.resetHomeMessage'),
            confirmLabel: themeT('themes.actions.reset'),
            variant: 'warning',
            action: resetHomePage,
          })}
          onRestore={() => requestConfirm({
            title: themeT('themes.confirm.restoreHomeTitle'),
            description: themeT('themes.confirm.restoreHomeMessage'),
            confirmLabel: themeT('themes.actions.restorePublished'),
            variant: 'warning',
            action: restorePublishedHomePage,
          })}
          onConfirm={requestConfirm}
        />
      ) : null}

      {selectedTemplate ? (
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Stack spacing={1.5}>
            <Typography variant="h6" sx={{ fontWeight: 900 }}>إعدادات الصفحة الرئيسية</Typography>
            <Typography color="text.secondary">هذه الحقول تأتي من schema القالب الحالي وتؤثر على البانر والأقسام والمنتجات المعروضة.</Typography>
            {selectedTemplate ? (
              <SettingsEditor
                schema={selectedTemplate?.settingsSchema ?? {}}
                values={settingsDraft}
                request={request}
                onChange={(key, value) => setSettingsDraft((current) => setByPath(current, normalizeConfigPath(key), value))}
              />
            ) : null}
          </Stack>
        </Paper>
      ) : null}

      {activeTab === 'shell' ? (
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Stack spacing={1.5}>
            <Typography variant="h6" sx={{ fontWeight: 900 }}>إعدادات الهيدر والفوتر المتاحة في هذا القالب</Typography>
            <Typography color="text.secondary">يعرض هذا التبويب الحقول المرتبطة فعلياً بالهيدر والفوتر فقط.</Typography>
            {selectedTemplate ? (
              <SettingsEditor
                schema={filterSchemaForShell(selectedTemplate.settingsSchema ?? {})}
                values={settingsDraft}
                request={request}
                emptyMessage="هذا القالب لا يوفر إعدادات مخصصة للهيدر والفوتر حالياً."
                onChange={(key, value) => setSettingsDraft((current) => setByPath(current, normalizeConfigPath(key), value))}
              />
            ) : null}
          </Stack>
        </Paper>
      ) : null}

      {activeTab === 'publish' ? (
        <PublishPanel
          themeState={themeState}
          previewToken={previewToken}
          storefrontBaseUrl={storefrontBaseUrl}
          storeSlug={storeSlug}
          isDraftPublished={isDraftPublished}
          disabled={actionLoading}
          onPreview={() => createPreviewToken().catch(() => undefined)}
          onSave={() => saveDraft().catch(() => undefined)}
          onPublish={() => requestConfirm({
            title: themeT('themes.confirm.publishTitle'),
            description: themeT('themes.confirm.publishMessage'),
            confirmLabel: themeT('themes.actions.publish'),
            variant: 'warning',
            action: publishDraft,
          })}
          onRestore={() => requestConfirm({
            title: themeT('themes.confirm.restorePublishedTitle'),
            description: themeT('themes.confirm.restorePublishedMessage'),
            confirmLabel: themeT('themes.actions.restorePublished'),
            variant: 'warning',
            action: restorePublished,
          })}
          onReset={() => requestConfirm({
            title: themeT('themes.confirm.resetTemplateTitle'),
            description: themeT('themes.confirm.resetTemplateMessage'),
            confirmLabel: themeT('themes.actions.reset'),
            variant: 'warning',
            action: resetTemplate,
          })}
        />
      ) : null}
      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        description={confirmState.description}
        confirmLabel={confirmState.confirmLabel ?? themeT('themes.actions.confirm')}
        cancelLabel={themeT('themes.actions.cancel')}
        variant={confirmState.variant ?? 'default'}
        loading={actionLoading}
        onCancel={closeConfirm}
        onConfirm={() => runConfirmedAction().catch(() => undefined)}
      />
    </Stack>
  );
}

function HomePageComposerPanel({
  request,
  sections,
  registry,
  disabled,
  onChange,
  onSave,
  onReset,
  onRestore,
  onConfirm,
}: {
  request: MerchantRequester;
  sections: HomeSection[];
  registry: HomeSectionDefinition[];
  disabled: boolean;
  onChange: (sections: HomeSection[]) => void;
  onSave: () => void;
  onReset: () => void;
  onRestore: () => void;
  onConfirm: (next: Omit<ConfirmState, 'open'>) => void;
}) {
  const nextSectionIdRef = useRef(sections.length);
  const [selectedId, setSelectedId] = useState(sections[0]?.id ?? '');
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<ProductListResponse['items']>([]);
  const [productSearch, setProductSearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState('');
  const selectedSection = sections.find((section) => section.id === selectedId) ?? sections[0] ?? null;
  const selectedDefinition = selectedSection ? registry.find((item) => item.type === selectedSection.type) ?? null : null;

  useEffect(() => {
    if (!selectedId || !sections.some((section) => section.id === selectedId)) {
      setSelectedId(sections[0]?.id ?? '');
    }
  }, [sections, selectedId]);

  useEffect(() => {
    let mounted = true;
    setPickerLoading(true);
    setPickerError('');
    const query = new URLSearchParams({ page: '1', limit: '20' });
    if (productSearch.trim()) query.set('search', productSearch.trim());
    const categoryQuery = categorySearch.trim() ? `?search=${encodeURIComponent(categorySearch.trim())}&limit=20` : '?limit=20';
    Promise.all([
      request<Category[]>(`/categories${categoryQuery}`, { method: 'GET' }).catch(() => []),
      request<ProductListResponse>(`/products?${query.toString()}`, { method: 'GET' }).catch(() => ({ items: [], total: 0, page: 1, limit: 20 })),
    ]).then(([categoryItems, productPage]) => {
      if (!mounted) return;
      setCategories(categoryItems ?? []);
      setProducts((productPage ?? { items: [] }).items);
      setPickerLoading(false);
    }).catch(() => {
      if (!mounted) return;
      setPickerError(themeT('themes.picker.failed'));
      setPickerLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [categorySearch, productSearch, request]);

  function updateSection(sectionId: string, updater: (section: HomeSection) => HomeSection): void {
    onChange(sections.map((section) => (section.id === sectionId ? updater(section) : section)));
  }

  function moveSection(sectionId: string, direction: -1 | 1): void {
    const index = sections.findIndex((section) => section.id === sectionId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= sections.length) return;
    const next = [...sections];
    const [item] = next.splice(index, 1);
    if (!item) return;
    next.splice(target, 0, item);
    onChange(next);
  }

  function addSection(definition: HomeSectionDefinition): void {
    nextSectionIdRef.current += 1;
    const id = `${definition.type}-${nextSectionIdRef.current}`;
    const section: HomeSection = {
      id,
      type: definition.type,
      variant: definition.defaultVariant,
      enabled: true,
      locked: definition.locked === true,
      settings: readConfigDraft(definition.defaultSettings),
      ...(definition.defaultSource ? { source: readConfigDraft(definition.defaultSource) } : {}),
    };
    onChange([...sections, section]);
    setSelectedId(id);
  }

  function duplicateSection(section: HomeSection): void {
    if (sections.length >= MAX_SECTIONS - 1) {
      onConfirm({
        title: themeT('themes.confirm.duplicateSectionTitle'),
        description: themeT('themes.confirm.duplicateSectionMessage'),
        confirmLabel: themeT('themes.actions.duplicate'),
        variant: 'warning',
        action: () => duplicateSectionNow(section),
      });
      return;
    }
    duplicateSectionNow(section);
  }

  function duplicateSectionNow(section: HomeSection): void {
    const next = { ...(JSON.parse(JSON.stringify(section)) as HomeSection), id: `${section.type}-${Date.now()}`, locked: false };
    onChange([...sections, next]);
    setSelectedId(next.id);
  }

  function deleteSection(section: HomeSection): void {
    if (section.locked) return;
    onConfirm({
      title: themeT('themes.confirm.deleteSectionTitle'),
      description: themeT('themes.confirm.deleteSectionMessage'),
      confirmLabel: themeT('themes.actions.delete'),
      variant: 'danger',
      action: () => onChange(sections.filter((item) => item.id !== section.id)),
    });
  }

  function handleDragStart(event: DragEvent, sectionId: string): void {
    event.dataTransfer.setData('text/plain', sectionId);
    event.dataTransfer.effectAllowed = 'move';
  }

  function handleDrop(event: DragEvent, targetId: string): void {
    event.preventDefault();
    const sourceId = event.dataTransfer.getData('text/plain');
    if (!sourceId || sourceId === targetId) return;
    const sourceIndex = sections.findIndex((section) => section.id === sourceId);
    const targetIndex = sections.findIndex((section) => section.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const next = [...sections];
    const [item] = next.splice(sourceIndex, 1);
    if (!item) return;
    next.splice(targetIndex, 0, item);
    onChange(next);
  }

  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 900 }}>مؤلف الصفحة الرئيسية</Typography>
            <Typography color="text.secondary">رتب الأقسام، اختر الشكل، وعدل المحتوى ومصدر البيانات داخل المسودة.</Typography>
          </Box>
          <Stack direction="row" gap={1} flexWrap="wrap">
            <Button startIcon={<SaveIcon />} variant="contained" disabled={disabled} onClick={onSave}>حفظ الصفحة</Button>
            <Button startIcon={<UndoIcon />} variant="outlined" disabled={disabled} onClick={onRestore}>استعادة المنشور</Button>
            <Button startIcon={<ReplayOutlinedIcon />} color="warning" variant="outlined" disabled={disabled} onClick={onReset}>إعادة ضبط</Button>
          </Stack>
        </Stack>
      </Paper>

      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2}>
        <Paper variant="outlined" sx={{ p: 2, flex: 0.9, borderRadius: 2 }}>
          <Stack spacing={1.5}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography sx={{ fontWeight: 900 }}>الأقسام</Typography>
              <Chip size="small" label={`${sections.length} قسم`} />
            </Stack>
            {sections.length === 0 ? (
              <Alert severity="info">
                <Typography sx={{ fontWeight: 800 }}>{themeT('themes.home.emptyTitle')}</Typography>
                <Typography variant="body2">{themeT('themes.home.emptyDescription')}</Typography>
              </Alert>
            ) : null}
            {sections.map((section, index) => {
              const definition = registry.find((item) => item.type === section.type);
              return (
                <Paper
                  key={section.id}
                  draggable={!disabled}
                  onDragStart={(event) => handleDragStart(event, section.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => handleDrop(event, section.id)}
                  variant="outlined"
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedId(section.id)}
                  sx={{ p: 1.25, borderRadius: 1.5, borderColor: selectedSection?.id === section.id ? 'primary.main' : 'divider', cursor: 'grab' }}
                >
                  <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                    <Box>
                      <Typography sx={{ fontWeight: 800 }}>{definition?.label ?? section.type}</Typography>
                      <Typography variant="caption" color="text.secondary">{section.id}</Typography>
                    </Box>
                    <Stack direction="row" gap={0.5} alignItems="center">
                      <Chip size="small" label={section.enabled ? 'ظاهر' : 'مخفي'} color={section.enabled ? 'success' : 'default'} />
                      <Button size="small" disabled={disabled || index === 0} onClick={(event) => { event.stopPropagation(); moveSection(section.id, -1); }}>أعلى</Button>
                      <Button size="small" disabled={disabled || index === sections.length - 1} onClick={(event) => { event.stopPropagation(); moveSection(section.id, 1); }}>أسفل</Button>
                    </Stack>
                  </Stack>
                </Paper>
              );
            })}
            <Divider />
            <Typography sx={{ fontWeight: 900 }}>إضافة قسم</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 1 }}>
              {registry.map((definition) => (
                <Button key={definition.type} variant="outlined" disabled={disabled} onClick={() => addSection(definition)}>
                  {definition.label}
                </Button>
              ))}
            </Box>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, flex: 1.1, borderRadius: 2 }}>
          {selectedSection && selectedDefinition ? (
            <Stack spacing={1.5}>
              <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={1}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 900 }}>{selectedDefinition.label}</Typography>
                  <Typography variant="body2" color="text.secondary">{selectedDefinition.description}</Typography>
                </Box>
                <Stack direction="row" gap={1} flexWrap="wrap">
                  <Button size="small" variant="outlined" disabled={disabled} onClick={() => duplicateSection(selectedSection)}>نسخ</Button>
                  <Button size="small" color="error" variant="outlined" disabled={disabled || selectedSection.locked} onClick={() => deleteSection(selectedSection)}>حذف</Button>
                </Stack>
              </Stack>
              <Divider />
              <FormControlLabel
                control={<Switch checked={selectedSection.enabled} onChange={(event) => updateSection(selectedSection.id, (section) => ({ ...section, enabled: event.target.checked }))} />}
                label="إظهار القسم في الصفحة"
              />
              <TextField
                select
                label="Variant"
                value={selectedSection.variant}
                onChange={(event) => updateSection(selectedSection.id, (section) => ({ ...section, variant: event.target.value }))}
                disabled={disabled}
                fullWidth
              >
                {selectedDefinition.variants.map((variant) => <MenuItem key={variant} value={variant}>{variant}</MenuItem>)}
              </TextField>
              {selectedDefinition.sourceTypes.length > 1 || selectedSection.source ? (
                <Stack spacing={1}>
                  <Typography sx={{ fontWeight: 800 }}>مصدر البيانات</Typography>
                  <TextField
                    select
                    label="Source"
                    value={readSupportedSourceType(selectedSection, selectedDefinition)}
                    onChange={(event) => updateSection(selectedSection.id, (section) => ({ ...section, source: { ...asRecord(section.source), type: event.target.value } }))}
                    disabled={disabled}
                    fullWidth
                  >
                    {selectedDefinition.sourceTypes.map((sourceType) => <MenuItem key={sourceType} value={sourceType}>{sourceType}</MenuItem>)}
                  </TextField>
                  {['products', 'categories', 'brands'].includes(selectedSection.type) ? (
                    <TextField
                      label="Limit"
                      type="number"
                      value={readNumber(asRecord(selectedSection.source).limit ?? selectedSection.settings.limit, 8)}
                      onChange={(event) => updateSection(selectedSection.id, (section) => ({ ...section, source: { ...asRecord(section.source), limit: Number(event.target.value) } }))}
                      disabled={disabled}
                      inputProps={{ min: 1, max: 24 }}
                    />
                  ) : null}
                  {readSupportedSourceType(selectedSection, selectedDefinition) === 'category' ? (
                    <Stack spacing={1}>
                      <TextField
                        label={themeT('themes.picker.searchCategories')}
                        value={categorySearch}
                        onChange={(event) => setCategorySearch(event.target.value)}
                        disabled={disabled}
                        size="small"
                        fullWidth
                      />
                      <TextField
                        select
                        label="Category ID"
                        value={readInputString(asRecord(selectedSection.source).categoryId, '')}
                        onChange={(event) => updateSection(selectedSection.id, (section) => ({ ...section, source: { ...asRecord(section.source), categoryId: event.target.value } }))}
                        disabled={disabled}
                        fullWidth
                      >
                        <MenuItem value="">بدون تحديد</MenuItem>
                        {categories.map((category) => (
                          <MenuItem key={category.id} value={category.id}>{category.nameAr || category.nameEn || category.name}</MenuItem>
                        ))}
                      </TextField>
                      {pickerLoading ? <LinearProgress /> : null}
                      {!pickerLoading && categories.length === 0 ? <Alert severity="info">{themeT('themes.picker.noCategories')}</Alert> : null}
                    </Stack>
                  ) : null}
                  {readSupportedSourceType(selectedSection, selectedDefinition) === 'selectedProducts' ? (
                    <Stack spacing={1}>
                      <TextField
                        label={themeT('themes.picker.searchProducts')}
                        value={productSearch}
                        onChange={(event) => setProductSearch(event.target.value)}
                        disabled={disabled}
                        size="small"
                        fullWidth
                      />
                      <TextField
                        select
                        SelectProps={{ multiple: true }}
                        label="المنتجات المختارة"
                        value={Array.isArray(asRecord(selectedSection.source).productIds) ? asRecord(selectedSection.source).productIds : []}
                        onChange={(event) => {
                          const rawValue = event.target.value;
                          const productIds = Array.isArray(rawValue) ? rawValue : String(rawValue).split(',');
                          updateSection(selectedSection.id, (section) => ({ ...section, source: { ...asRecord(section.source), productIds } }));
                        }}
                        disabled={disabled}
                        fullWidth
                      >
                        {products.map((product) => (
                          <MenuItem key={product.id} value={product.id}>
                            {product.titleAr || product.titleEn || product.title} {product.status ? `- ${product.status}` : ''}
                          </MenuItem>
                        ))}
                      </TextField>
                      {pickerLoading ? <LinearProgress /> : null}
                      {!pickerLoading && products.length === 0 ? <Alert severity="info">{themeT('themes.picker.noProducts')}</Alert> : null}
                    </Stack>
                  ) : null}
                  {readSupportedSourceType(selectedSection, selectedDefinition) === 'selectedCategories' ? (
                    <Stack spacing={1}>
                      <TextField
                        label={themeT('themes.picker.searchCategories')}
                        value={categorySearch}
                        onChange={(event) => setCategorySearch(event.target.value)}
                        disabled={disabled}
                        size="small"
                        fullWidth
                      />
                      <TextField
                        select
                        SelectProps={{ multiple: true }}
                        label="التصنيفات المختارة"
                        value={Array.isArray(asRecord(selectedSection.source).categoryIds) ? asRecord(selectedSection.source).categoryIds : []}
                        onChange={(event) => {
                          const rawValue = event.target.value;
                          const categoryIds = Array.isArray(rawValue) ? rawValue : String(rawValue).split(',');
                          updateSection(selectedSection.id, (section) => ({ ...section, source: { ...asRecord(section.source), categoryIds } }));
                        }}
                        disabled={disabled}
                        fullWidth
                      >
                        {categories.map((category) => (
                          <MenuItem key={category.id} value={category.id}>{category.nameAr || category.nameEn || category.name}</MenuItem>
                        ))}
                      </TextField>
                      {pickerLoading ? <LinearProgress /> : null}
                      {!pickerLoading && categories.length === 0 ? <Alert severity="info">{themeT('themes.picker.noCategories')}</Alert> : null}
                    </Stack>
                  ) : null}
                  {pickerError ? <Alert severity="error">{pickerError}</Alert> : null}
                </Stack>
              ) : null}
              <Typography sx={{ fontWeight: 800 }}>إعدادات القسم</Typography>
              <SectionSettingsFields
                section={selectedSection}
                disabled={disabled}
                request={request}
                onChange={(key, value) => updateSection(selectedSection.id, (section) => ({ ...section, settings: setByPath(section.settings, key, value) }))}
              />
            </Stack>
          ) : (
            <Typography color="text.secondary">اختر قسما لتعديل إعداداته.</Typography>
          )}
        </Paper>
      </Stack>
    </Stack>
  );
}

function SectionSettingsFields({
  section,
  disabled,
  request,
  onChange,
}: {
  section: HomeSection;
  disabled: boolean;
  request: MerchantRequester;
  onChange: (key: string, value: unknown) => void;
}) {
  const settings = section.settings;
  const fields = getSectionEditableFields(section.type);
  const items = Array.isArray(settings.items) ? settings.items.map((item) => asRecord(item)) : [];
  const stats = Array.isArray(settings.stats) ? settings.stats.map((item) => asRecord(item)) : [];
  return (
    <Stack spacing={1.25}>
      {fields.map((field) => {
        const value = getByPath(settings, field.key);
        if (field.type === 'image') {
          return (
            <ImageField
              key={field.key}
              label={field.label}
              value={readInputString(value, '')}
              request={request}
              disabled={disabled}
              onChange={(next) => onChange(field.key, next)}
            />
          );
        }
        if (field.type === 'boolean') {
          return (
            <FormControlLabel
              key={field.key}
              control={<Switch checked={Boolean(value)} disabled={disabled} onChange={(event) => onChange(field.key, event.target.checked)} />}
              label={field.label}
            />
          );
        }
        return (
          <TextField
            key={field.key}
            label={field.label}
            value={readInputString(value, '')}
            type={field.type === 'number' ? 'number' : 'text'}
            multiline={field.type === 'textarea'}
            minRows={field.type === 'textarea' ? 3 : undefined}
            disabled={disabled}
            onChange={(event) => onChange(field.key, field.type === 'number' ? Number(event.target.value) : event.target.value)}
            fullWidth
          />
        );
      })}
      {section.type === 'promoBanners' ? (
        <RepeaterField
          label="البانرات الترويجية"
          value={items}
          createItem={() => ({ title: '', description: '', imageUrl: '', href: '', ctaLabel: '' })}
          onChange={(next) => onChange('items', next)}
          disabled={disabled}
          renderItem={(item, index, updateItem) => (
            <Stack spacing={1}>
              <TextField label="العنوان" value={readInputString(item.title, '')} disabled={disabled} onChange={(event) => updateItem({ ...item, title: event.target.value })} fullWidth size="small" />
              <TextField label="الوصف" value={readInputString(item.description, '')} disabled={disabled} onChange={(event) => updateItem({ ...item, description: event.target.value })} fullWidth size="small" multiline minRows={2} />
              <ImageField label="الصورة" value={readInputString(item.imageUrl, '')} request={request} disabled={disabled} onChange={(value) => updateItem({ ...item, imageUrl: value })} />
              <TextField label="رابط الانتقال" value={readInputString(item.href, '')} disabled={disabled} onChange={(event) => updateItem({ ...item, href: event.target.value })} fullWidth size="small" />
              <TextField label="نص الزر" value={readInputString(item.ctaLabel, '')} disabled={disabled} onChange={(event) => updateItem({ ...item, ctaLabel: event.target.value })} fullWidth size="small" />
            </Stack>
          )}
        />
      ) : null}
      {section.type === 'trustBadges' ? (
        <RepeaterField
          label="شارات الثقة"
          value={items}
          createItem={() => ({ title: '', description: '', icon: 'shield' })}
          onChange={(next) => onChange('items', next)}
          disabled={disabled}
          renderItem={(item, index, updateItem) => (
            <Stack spacing={1}>
              <TextField label="العنوان" value={readInputString(item.title, '')} disabled={disabled} onChange={(event) => updateItem({ ...item, title: event.target.value })} fullWidth size="small" />
              <TextField label="الوصف" value={readInputString(item.description, '')} disabled={disabled} onChange={(event) => updateItem({ ...item, description: event.target.value })} fullWidth size="small" multiline minRows={2} />
              <TextField select label="الأيقونة" value={readInputString(item.icon, 'shield')} disabled={disabled} onChange={(event) => updateItem({ ...item, icon: event.target.value })} fullWidth size="small">
                {SAFE_TRUST_BADGE_ICONS.map((icon) => <MenuItem key={icon} value={icon}>{icon}</MenuItem>)}
              </TextField>
            </Stack>
          )}
        />
      ) : null}
      {section.type === 'storeStory' ? (
        <RepeaterField
          label="إحصائيات القصة"
          value={stats}
          createItem={() => ({ value: '', label: '' })}
          onChange={(next) => onChange('stats', next)}
          disabled={disabled}
          renderItem={(item, index, updateItem) => (
            <Stack spacing={1}>
              <TextField label="القيمة" value={readInputString(item.value, '')} disabled={disabled} onChange={(event) => updateItem({ ...item, value: event.target.value })} fullWidth size="small" />
              <TextField label="العنوان" value={readInputString(item.label, '')} disabled={disabled} onChange={(event) => updateItem({ ...item, label: event.target.value })} fullWidth size="small" />
            </Stack>
          )}
        />
      ) : null}
    </Stack>
  );
}

function getSectionEditableFields(type: HomeSectionType): Array<{ key: string; label: string; type: 'text' | 'textarea' | 'number' | 'boolean' | 'image' }> {
  const common = [
    { key: 'title', label: 'العنوان', type: 'text' as const },
    { key: 'subtitle', label: 'الوصف المختصر', type: 'textarea' as const },
    { key: 'showViewAll', label: 'إظهار زر عرض الكل', type: 'boolean' as const },
    { key: 'viewAllHref', label: 'رابط عرض الكل', type: 'text' as const },
  ];
  if (type === 'hero') {
    return [
      { key: 'headline', label: 'العنوان الرئيسي', type: 'text' },
      { key: 'subheadline', label: 'الوصف', type: 'textarea' },
      { key: 'imageUrl', label: 'الصورة', type: 'image' },
      { key: 'backgroundImageUrl', label: 'صورة الخلفية', type: 'image' },
      { key: 'ctaLabel', label: 'نص الزر الرئيسي', type: 'text' },
      { key: 'ctaHref', label: 'رابط الزر الرئيسي', type: 'text' },
      { key: 'secondaryCtaLabel', label: 'نص الزر الثانوي', type: 'text' },
      { key: 'secondaryCtaHref', label: 'رابط الزر الثانوي', type: 'text' },
      { key: 'showSearch', label: 'إظهار البحث', type: 'boolean' },
    ];
  }
  if (type === 'storeStory' || type === 'contactStrip' || type === 'newsletter' || type === 'customContent') {
    const fields: Array<{ key: string; label: string; type: 'text' | 'textarea' | 'number' | 'boolean' | 'image' }> = [
      { key: 'title', label: 'العنوان', type: 'text' },
      { key: 'description', label: 'الوصف', type: 'textarea' },
      { key: 'body', label: 'المحتوى', type: 'textarea' },
      { key: 'ctaLabel', label: 'نص الزر', type: 'text' },
      { key: 'ctaHref', label: 'رابط الزر', type: 'text' },
    ];
    if (type === 'storeStory' || type === 'customContent') {
      fields.splice(2, 0, { key: 'imageUrl', label: 'الصورة', type: 'image' });
    }
    return fields;
  }
  return [
    ...common,
    { key: 'limit', label: 'عدد العناصر', type: 'number' },
  ];
}

function RepeaterField<T extends Record<string, unknown>>({
  label,
  value,
  createItem,
  renderItem,
  onChange,
  disabled,
  minItems = 0,
  maxItems = MAX_REPEATER_ITEMS,
}: {
  label: string;
  value: T[];
  createItem: () => T;
  renderItem: (item: T, index: number, updateItem: (next: T) => void) => ReactNode;
  onChange: (items: T[]) => void;
  disabled: boolean;
  minItems?: number;
  maxItems?: number;
}) {
  const safeItems = Array.isArray(value) ? value : [];

  function updateItem(index: number, nextItem: T): void {
    onChange(safeItems.map((item, itemIndex) => (itemIndex === index ? nextItem : item)));
  }

  function moveItem(index: number, direction: -1 | 1): void {
    const target = index + direction;
    if (target < 0 || target >= safeItems.length) return;
    const next = [...safeItems];
    const [item] = next.splice(index, 1);
    if (!item) return;
    next.splice(target, 0, item);
    onChange(next);
  }

  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
      <Stack spacing={1.25}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
          <Typography sx={{ fontWeight: 900 }}>{label}</Typography>
          <Chip size="small" label={`${safeItems.length}/${maxItems}`} />
        </Stack>
        {safeItems.length === 0 ? <Alert severity="info">{themeT('themes.repeater.empty')}</Alert> : null}
        {safeItems.map((item, index) => (
          <Paper key={index} variant="outlined" sx={{ p: 1.25, borderRadius: 1.5 }}>
            <Stack spacing={1.25}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                <Typography sx={{ fontWeight: 800 }}>{label} #{index + 1}</Typography>
                <Stack direction="row" gap={0.5} flexWrap="wrap">
                  <Button size="small" disabled={disabled || index === 0} onClick={() => moveItem(index, -1)}>{themeT('themes.repeater.moveUp')}</Button>
                  <Button size="small" disabled={disabled || index === safeItems.length - 1} onClick={() => moveItem(index, 1)}>{themeT('themes.repeater.moveDown')}</Button>
                  <Button size="small" color="error" disabled={disabled || safeItems.length <= minItems} onClick={() => onChange(safeItems.filter((_, itemIndex) => itemIndex !== index))}>{themeT('themes.repeater.removeItem')}</Button>
                </Stack>
              </Stack>
              {renderItem(item, index, (nextItem) => updateItem(index, nextItem))}
            </Stack>
          </Paper>
        ))}
        <Button
          variant="outlined"
          disabled={disabled || safeItems.length >= maxItems}
          onClick={() => onChange([...safeItems, createItem()])}
        >
          {themeT('themes.repeater.addItem')}
        </Button>
      </Stack>
    </Paper>
  );
}

function TemplateCard({
  template,
  selected,
  disabled,
  onSelect,
  onApply,
  onApplyAndPublish,
}: {
  template: ThemeTemplate;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
  onApply: () => void;
  onApplyAndPublish: () => void;
}) {
  const preview = template.previewImageUrl || template.thumbnailUrl || template.previewImages[0] || '';
  const production = readTemplateProduction(template.capabilities);
  const supportedPages = readSupportedPageCount(template.capabilities);
  return (
    <Paper
      variant="outlined"
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      aria-pressed={selected}
      sx={{
        borderColor: selected ? 'primary.main' : 'divider',
        borderRadius: 2,
        cursor: 'pointer',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ aspectRatio: '16 / 10', bgcolor: 'action.hover', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
        {preview ? (
          <Box component="img" src={preview} alt={template.name} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <Stack alignItems="center" gap={1} color="text.secondary">
            <ImageIcon />
            <Typography variant="caption">صورة المعاينة غير مضافة</Typography>
          </Stack>
        )}
      </Box>
      <Stack spacing={1.25} sx={{ p: 1.5 }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
          <Box>
            <Typography sx={{ fontWeight: 900 }}>{template.name}</Typography>
            <Typography variant="caption" color="text.secondary">{template.templateKey}</Typography>
          </Box>
          {selected ? <CheckCircleIcon color="primary" /> : <StorefrontIcon color="action" />}
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ minHeight: 42 }}>{template.description}</Typography>
        <Stack direction="row" gap={0.75} flexWrap="wrap">
          <Chip size="small" label={formatCategory(template.category)} />
          <Chip size="small" label={template.componentKey} variant="outlined" />
          <Chip size="small" color={production.status === 'production_ready' ? 'success' : 'warning'} label={`${production.label} ${production.score}/100`} variant="outlined" />
          <Chip size="small" label={`${supportedPages.completed}/${supportedPages.total} صفحات`} variant="outlined" />
          {template.isPremium ? <Chip size="small" color="warning" label="مدفوع" /> : <Chip size="small" color="success" label="مجاني" />}
        </Stack>
        <Stack direction="row" gap={1}>
          <Button size="small" variant="outlined" disabled={disabled} onClick={(event) => { event.stopPropagation(); onApply(); }}>
            كمسودة
          </Button>
          <Button size="small" variant="contained" disabled={disabled} onClick={(event) => { event.stopPropagation(); onApplyAndPublish(); }}>
            تطبيق ونشر
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}

function ThemeStatusCard({
  themeState,
  selectedTemplate,
  isDraftPublished,
  disabled,
  onPreview,
  onSave,
  onPublish,
}: {
  themeState: ThemeState | null;
  selectedTemplate: ThemeTemplate | null;
  isDraftPublished: boolean;
  disabled: boolean;
  onPreview: () => void;
  onSave: () => void;
  onPublish: () => void;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2}>
        <Stack spacing={0.75}>
          <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
            <Typography variant="h6" sx={{ fontWeight: 900 }}>
              {readString(themeState?.templateName, selectedTemplate?.name ?? 'القالب الحالي')}
            </Typography>
            <Chip size="small" color={isDraftPublished ? 'success' : 'warning'} label={isDraftPublished ? 'منشور' : 'تغييرات غير منشورة'} />
            <Chip size="small" variant="outlined" label={`v${themeState?.publishedVersion ?? themeState?.version ?? 1}`} />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            آخر نشر: {themeState?.lastPublishedAt ? new Date(themeState.lastPublishedAt).toLocaleString('ar') : 'لا توجد نسخة منشورة مسجلة'}
          </Typography>
        </Stack>
        <Stack direction="row" gap={1} flexWrap="wrap">
          <Button startIcon={<VisibilityIcon />} variant="outlined" disabled={disabled} onClick={onPreview}>معاينة</Button>
          <Button startIcon={<SaveIcon />} variant="outlined" disabled={disabled} onClick={onSave}>حفظ المسودة</Button>
          <Button startIcon={<RocketLaunchIcon />} variant="contained" disabled={disabled || isDraftPublished} onClick={onPublish}>نشر التغييرات</Button>
        </Stack>
      </Stack>
    </Paper>
  );
}

function IdentityPanel({
  design,
  presets,
  contrastItems,
  disabled,
  onChange,
  onApplyPreset,
  onSave,
  onReset,
  onRestore,
}: {
  design: Record<string, unknown>;
  presets: DesignPreset[];
  contrastItems: ContrastItem[];
  disabled: boolean;
  onChange: (path: string, value: unknown) => void;
  onApplyPreset: (presetKey: string) => void;
  onSave: () => void;
  onReset: () => void;
  onRestore: () => void;
}) {
  const colors = asRecord(design.colors);
  const typography = asRecord(design.typography);
  const radius = asRecord(design.radius);
  const buttons = asRecord(design.buttons);
  const cards = asRecord(design.cards);
  const layout = asRecord(design.layout);
  const background = asRecord(design.background);

  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 900 }}>هوية المتجر</Typography>
            <Typography color="text.secondary">ألوان وخطوط وأزرار وبطاقات موحدة لكل القوالب.</Typography>
          </Box>
          <Stack direction="row" gap={1} flexWrap="wrap">
            <Button startIcon={<SaveIcon />} variant="contained" disabled={disabled} onClick={onSave}>حفظ الهوية</Button>
            <Button startIcon={<UndoIcon />} color="warning" variant="outlined" disabled={disabled} onClick={onRestore}>{themeT('themes.identity.restorePublished')}</Button>
            <Button startIcon={<ReplayOutlinedIcon />} color="warning" variant="outlined" disabled={disabled} onClick={onReset}>إعادة ضبط</Button>
          </Stack>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
        <Typography sx={{ fontWeight: 900, mb: 1.5 }}>الأنماط الجاهزة</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 1.5 }}>
          {presets.map((preset) => (
            <Paper key={preset.key} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between" gap={1}>
                  <Typography sx={{ fontWeight: 800 }}>{preset.name}</Typography>
                  <Chip size="small" label={preset.category} />
                </Stack>
                <Stack direction="row" gap={0.75}>
                  {Object.values(preset.preview).slice(0, 5).map((color) => (
                    <Box key={color} sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: color, border: '1px solid', borderColor: 'divider' }} />
                  ))}
                </Stack>
                <Button size="small" startIcon={<PaletteIcon />} variant="outlined" disabled={disabled} onClick={() => onApplyPreset(preset.key)}>
                  تطبيق كنمط
                </Button>
              </Stack>
            </Paper>
          ))}
        </Box>
      </Paper>

      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2}>
        <Paper variant="outlined" sx={{ p: 2, flex: 1, borderRadius: 2 }}>
          <Stack spacing={1.5}>
            <Typography sx={{ fontWeight: 900 }}>الألوان</Typography>
            {([
              ['primary', 'اللون الرئيسي'],
              ['primaryForeground', 'نص اللون الرئيسي'],
              ['secondary', 'اللون الثانوي'],
              ['secondaryForeground', 'نص اللون الثانوي'],
              ['accent', 'لون التمييز'],
              ['background', 'الخلفية'],
              ['surface', 'سطح البطاقات'],
              ['surfaceMuted', 'سطح هادئ'],
              ['text', 'النص'],
              ['mutedText', 'نص ثانوي'],
              ['border', 'الحدود'],
            ] satisfies Array<[string, string]>).map(([key, label]) => (
              <ColorField
                key={key}
                label={label}
                value={readInputString(colors[key], key.includes('Foreground') ? '#ffffff' : '#0f766e')}
                onChange={(value) => onChange(`colors.${key}`, value)}
              />
            ))}
            <Stack direction="row" gap={0.75} flexWrap="wrap">
              {contrastItems.map((item) => (
                <Chip
                  key={item.pair}
                  size="small"
                  color={item.status === 'pass' ? 'success' : item.status === 'fail' ? 'error' : 'warning'}
                  label={`${item.pair}: ${item.ratio ?? '-'}`}
                />
              ))}
            </Stack>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, flex: 1, borderRadius: 2 }}>
          <Stack spacing={1.5}>
            <Typography sx={{ fontWeight: 900 }}>الخطوط والأزرار والبطاقات</Typography>
            <TextField select label="خط العناوين" size="small" value={readInputString(typography.headingFont, 'Cairo')} onChange={(event) => onChange('typography.headingFont', event.target.value)} fullWidth>
              {SUPPORTED_THEME_FONTS.map((font) => <MenuItem key={font} value={font}>{font}</MenuItem>)}
            </TextField>
            <TextField select label="خط النصوص" size="small" value={readInputString(typography.bodyFont, 'Cairo')} onChange={(event) => onChange('typography.bodyFont', event.target.value)} fullWidth>
              {SUPPORTED_THEME_FONTS.map((font) => <MenuItem key={font} value={font}>{font}</MenuItem>)}
            </TextField>
            <TextField select label="حجم الخط" size="small" value={readInputString(typography.fontScale, 'normal')} onChange={(event) => onChange('typography.fontScale', event.target.value)} fullWidth>
              {['compact', 'normal', 'large'].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
            </TextField>
            <TextField select label="شكل الزر" size="small" value={readButtonStyle(buttons.style)} onChange={(event) => onChange('buttons.style', event.target.value)} fullWidth>
              {['filled', 'outline', 'soft', 'ghost'].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
            </TextField>
            <TextField select label="شكل البطاقة" size="small" value={readInputString(cards.style, 'soft-shadow')} onChange={(event) => onChange('cards.style', event.target.value)} fullWidth>
              {['flat', 'bordered', 'soft-shadow', 'strong-shadow', 'luxury', 'warm-shadow', 'fresh-shadow'].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
            </TextField>
            <TextField label="استدارة الأزرار" size="small" value={readInputString(radius.button, '999px')} onChange={(event) => onChange('radius.button', event.target.value)} fullWidth />
            <TextField label="استدارة البطاقات" size="small" value={readInputString(radius.card, '24px')} onChange={(event) => onChange('radius.card', event.target.value)} fullWidth />
            <TextField select label="كثافة التصميم" size="small" value={readInputString(layout.density, 'comfortable')} onChange={(event) => onChange('layout.density', event.target.value)} fullWidth>
              {['compact', 'comfortable', 'spacious'].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
            </TextField>
            <TextField select label="الخلفية" size="small" value={readInputString(background.style, 'clean')} onChange={(event) => onChange('background.style', event.target.value)} fullWidth>
              {['clean', 'soft-gradient', 'subtle-pattern', 'warm-surface'].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
            </TextField>
          </Stack>
        </Paper>
      </Stack>

      <Paper
        variant="outlined"
        sx={{
          p: 2,
          borderRadius: readInputString(radius.card, '24px'),
          bgcolor: readInputString(colors.surface, '#ffffff'),
          color: readInputString(colors.text, '#0f172a'),
          borderColor: readInputString(colors.border, '#e2e8f0'),
        }}
      >
        <Stack spacing={1.5}>
          <Typography sx={{ fontFamily: readInputString(typography.headingFont, 'Cairo'), fontWeight: 900 }}>معاينة الهوية</Typography>
          <Typography sx={{ color: readInputString(colors.mutedText, '#64748b'), fontFamily: readInputString(typography.bodyFont, 'Cairo') }}>
            نموذج مختصر لطريقة ظهور النصوص والبطاقات والأزرار بعد النشر.
          </Typography>
          <Button
            variant="contained"
            sx={{
              alignSelf: 'flex-start',
              bgcolor: readInputString(colors.primary, '#2563eb'),
              color: readInputString(colors.primaryForeground, '#ffffff'),
              borderRadius: readInputString(radius.button, '999px'),
            }}
          >
            زر تجريبي
          </Button>
        </Stack>
      </Paper>
    </Stack>
  );
}

function PublishPanel({
  themeState,
  previewToken,
  storefrontBaseUrl,
  storeSlug,
  isDraftPublished,
  disabled,
  onPreview,
  onSave,
  onPublish,
  onRestore,
  onReset,
}: {
  themeState: ThemeState | null;
  previewToken: PreviewTokenResponse | null;
  storefrontBaseUrl: string;
  storeSlug: string | null;
  isDraftPublished: boolean;
  disabled: boolean;
  onPreview: () => void;
  onSave: () => void;
  onPublish: () => void;
  onRestore: () => void;
  onReset: () => void;
}) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
        <Stack spacing={1.5}>
          <Typography sx={{ fontWeight: 900 }}>حالة النشر</Typography>
          <Chip color={isDraftPublished ? 'success' : 'warning'} label={isDraftPublished ? 'كل التغييرات منشورة' : 'توجد تغييرات غير منشورة'} />
          <Typography variant="body2" color="text.secondary">الإصدار المنشور: {themeState?.publishedVersion ?? themeState?.version ?? 1}</Typography>
          <Button startIcon={<SaveIcon />} variant="outlined" disabled={disabled} onClick={onSave}>حفظ المسودة</Button>
          <Button startIcon={<RocketLaunchIcon />} variant="contained" disabled={disabled || isDraftPublished} onClick={onPublish}>نشر التغييرات</Button>
        </Stack>
      </Paper>
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
        <Stack spacing={1.5}>
          <Typography sx={{ fontWeight: 900 }}>روابط المعاينة</Typography>
          <Button startIcon={<VisibilityIcon />} variant="outlined" disabled={disabled} onClick={onPreview}>إنشاء رابط معاينة</Button>
          {previewToken ? (
            <Button href={buildPreviewUrl(storefrontBaseUrl, previewToken.previewToken, storeSlug)} target="_blank" rel="noreferrer" variant="text">
              فتح رابط المعاينة
            </Button>
          ) : null}
        </Stack>
      </Paper>
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, borderColor: 'warning.light' }}>
        <Stack spacing={1.5}>
          <Typography sx={{ fontWeight: 900 }}>إجراءات الاستعادة</Typography>
          <Button startIcon={<UndoIcon />} color="warning" variant="outlined" disabled={disabled} onClick={onRestore}>إلغاء التغييرات غير المنشورة</Button>
          <Button startIcon={<ReplayOutlinedIcon />} color="warning" variant="outlined" disabled={disabled} onClick={onReset}>إعادة ضبط القالب</Button>
        </Stack>
      </Paper>
    </Box>
  );
}

function SettingsEditor({
  schema,
  values,
  request,
  emptyMessage = 'هذا القالب لا يحتوي إعدادات مخصصة.',
  onChange,
}: {
  schema: Record<string, unknown>;
  values: SettingsDraft;
  request: MerchantRequester;
  emptyMessage?: string;
  onChange: (key: string, value: unknown) => void;
}) {
  const groups = readSchemaGroups(schema);
  if (groups.length === 0) {
    return <Typography color="text.secondary">{emptyMessage}</Typography>;
  }

  return (
    <Stack spacing={2}>
      {groups.map((group) => (
        <Stack key={group.key} spacing={1.5}>
          {group.label ? <Typography sx={{ fontWeight: 900 }}>{group.label}</Typography> : null}
          {group.fields.map(({ key, field }) => {
        const type = field.type ?? 'text';
        const value = getByPath(values, normalizeConfigPath(key)) ?? field.default;
        const label = field.label ?? key;
        if (type === 'boolean') {
          return (
            <FormControlLabel
              key={key}
              control={<Switch checked={value === true} onChange={(event) => onChange(key, event.target.checked)} />}
              label={label}
            />
          );
        }
        if (type === 'select') {
          return (
            <TextField key={key} select label={label} value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(key, event.target.value)} fullWidth size="small">
              {(field.options ?? []).map((option) => {
                const normalized = typeof option === 'string' ? { value: option, label: option } : option;
                return <MenuItem key={normalized.value} value={normalized.value}>{normalized.label}</MenuItem>;
              })}
            </TextField>
          );
        }
        if (type === 'color') {
          return <ColorField key={key} label={label} value={readInputString(value, readString(field.default, '#0f766e'))} onChange={(next) => onChange(key, next)} />;
        }
        if (type === 'image') {
          return <ImageField key={key} label={label} value={readInputString(value, '')} request={request} onChange={(next) => onChange(key, next)} />;
        }
        return (
          <TextField
            key={key}
            label={label}
            type={type === 'number' ? 'number' : type === 'url' ? 'url' : 'text'}
            value={type === 'number' ? readNumber(value, field.min ?? 0) : readInputString(value, '')}
            onChange={(event) => onChange(key, type === 'number' ? Number(event.target.value) : event.target.value)}
            multiline={type === 'textarea'}
            minRows={type === 'textarea' ? 3 : undefined}
            inputProps={{ maxLength: field.maxLength, min: field.min, max: field.max }}
            fullWidth
            size="small"
          />
        );
          })}
        </Stack>
      ))}
    </Stack>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const normalizedValue = isValidHexColor(draft) ? draft : '#0f766e';
  const hasError = draft.length > 0 && !isValidHexColor(draft);

  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Box
          component="input"
          type="color"
          value={normalizedValue}
          onChange={(event) => {
            setDraft(event.target.value);
            onChange(event.target.value);
          }}
          aria-label={label}
          sx={{ width: 44, height: 40, p: 0.5, border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }}
        />
        <TextField
          label={label}
          value={draft}
          onChange={(event) => {
            const next = event.target.value.trim();
            if (next === '' || isPartialHexColor(next) || isValidHexColor(next)) {
              setDraft(next);
              if (isValidHexColor(next)) onChange(next);
            }
          }}
          error={hasError}
          helperText={hasError ? 'استخدم لون HEX صحيح مثل #0f766e أو #fff' : ' '}
          fullWidth
          size="small"
        />
      </Stack>
      <Stack direction="row" gap={0.75} flexWrap="wrap">
        {COLOR_PRESETS.map((preset) => (
          <Box
            component="button"
            key={preset}
            type="button"
            onClick={() => {
              setDraft(preset);
              onChange(preset);
            }}
            aria-label={preset}
            sx={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              border: 2,
              borderColor: value.toLowerCase() === preset ? 'text.primary' : 'divider',
              bgcolor: preset,
              cursor: 'pointer',
            }}
          />
        ))}
      </Stack>
    </Stack>
  );
}

function ImageField({
  label,
  value,
  request,
  disabled = false,
  onChange,
}: {
  label: string;
  value: string;
  request: MerchantRequester;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function handleUpload(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError('يجب أن تكون الصورة jpg أو png أو webp وبحجم لا يتجاوز 5MB.');
      event.target.value = '';
      return;
    }
    setUploading(true);
    setError('');
    try {
      const asset = await uploadMediaAsset(request, file);
      onChange(asset.url);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : themeT('themes.error.uploadFailed'));
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  }

  return (
    <Stack spacing={1}>
      <TextField
        label={label}
        type="url"
        value={value}
        disabled={disabled || uploading}
        onChange={(event) => onChange(event.target.value)}
        fullWidth
        size="small"
      />
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
        <Button variant="outlined" component="label" startIcon={<CloudUploadIcon />} disabled={disabled || uploading}>
          {uploading ? themeT('themes.upload.uploading') : value ? themeT('themes.upload.change') : themeT('themes.actions.upload')}
          <input type="file" accept="image/*" hidden onChange={(event) => handleUpload(event).catch(() => undefined)} />
        </Button>
        {value ? (
          <Button variant="text" color="inherit" onClick={() => onChange('')} disabled={disabled || uploading}>
            {themeT('themes.actions.removeImage')}
          </Button>
        ) : null}
      </Stack>
      {error ? <Alert severity="error">{error}</Alert> : null}
      {value ? (
        <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, overflow: 'hidden', bgcolor: 'action.hover', aspectRatio: '16 / 9' }}>
          <Box component="img" src={value} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </Box>
      ) : null}
    </Stack>
  );
}

function buildComponentConfig(template: ThemeTemplate | null, currentConfig: Record<string, unknown> | undefined, formValues: SettingsDraft): Record<string, unknown> {
  const currentMatchesTemplate = !template || readTemplateKey(currentConfig) === template.templateKey;
  const base = deepMerge(
    template?.defaultConfig ?? {},
    currentMatchesTemplate ? currentConfig ?? {} : {},
    formValues,
  );
  const existingTemplate = asRecord(base.template);

  return {
    ...base,
    schemaVersion: 3,
    template: {
      ...existingTemplate,
      id: template?.templateKey ?? readString(existingTemplate.id ?? existingTemplate.key, 'general-starter'),
      key: template?.templateKey ?? readString(existingTemplate.key ?? existingTemplate.id, 'general-starter'),
      type: 'component',
      renderer: 'component',
      componentKey: template?.componentKey ?? readString(existingTemplate.componentKey, 'general-starter'),
      name: template?.name ?? readString(existingTemplate.name, ''),
      version: template?.version ?? readNumber(existingTemplate.version, 1),
    },
    globals: asRecord(base.globals),
    settings: asRecord(base.settings),
    layout: asRecord(base.layout),
    accessibility: asRecord(base.accessibility),
  };
}

function readTemplateKey(config: Record<string, unknown> | undefined | null): string {
  const template = asRecord(config?.template);
  return readString(template.id ?? template.key, '');
}

function readConfigDraft(config: Record<string, unknown>): SettingsDraft {
  return JSON.parse(JSON.stringify(config)) as SettingsDraft;
}

function readHomeSections(config: Record<string, unknown>): HomeSection[] {
  const pages = asRecord(config.pages);
  const home = asRecord(pages.home);
  const sections = Array.isArray(home.sections) ? home.sections : [];
  return sections
    .map((item) => asRecord(item))
    .filter((item) => readString(item.id, '') && readString(item.type, ''))
    .map((item) => ({
      id: readString(item.id, ''),
      type: readString(item.type, 'hero') as HomeSectionType,
      variant: readString(item.variant, 'default'),
      enabled: item.enabled !== false,
      locked: item.locked === true,
      settings: readConfigDraft(asRecord(item.settings)),
      ...(Object.keys(asRecord(item.source)).length > 0 ? { source: readConfigDraft(asRecord(item.source)) } : {}),
    }));
}

function resolveDesignFromConfig(config: Record<string, unknown>): Record<string, unknown> {
  const design = asRecord(config.design);
  if (Object.keys(design).length > 0) {
    return readConfigDraft(design);
  }
  const globals = asRecord(config.globals);
  const color = asRecord(globals.color);
  const typography = asRecord(globals.typography);
  const radius = asRecord(globals.radius);
  const layout = asRecord(config.layout);
  return {
    preset: 'default-clean',
    colors: {
      primary: readInputString(color.primary ?? globals.primaryColor, '#2563eb'),
      primaryForeground: readInputString(color.primaryContrast, '#ffffff'),
      secondary: readInputString(color.accent ?? globals.accentColor, '#f97316'),
      secondaryForeground: readInputString(color.accentContrast, '#ffffff'),
      accent: readInputString(color.accent, '#10b981'),
      background: readInputString(color.bg ?? globals.background, '#f8fafc'),
      surface: readInputString(color.surface, '#ffffff'),
      surfaceMuted: readInputString(color.bgSoft, '#f1f5f9'),
      text: readInputString(color.text, '#0f172a'),
      mutedText: readInputString(color.textMuted, '#64748b'),
      border: readInputString(color.line, '#e2e8f0'),
    },
    typography: {
      headingFont: readInputString(typography.headingFont ?? typography.headingFontFamily, 'Cairo'),
      bodyFont: readInputString(typography.bodyFont ?? typography.bodyFontFamily ?? globals.fontFamily, 'Cairo'),
      fontScale: 'normal',
    },
    radius: {
      button: readInputString(radius.button, '999px'),
      card: readInputString(radius.card, '24px'),
      input: readInputString(radius.input, '16px'),
      image: readInputString(radius.image, '20px'),
    },
    buttons: { style: 'filled', size: 'comfortable', uppercase: false },
    cards: { style: 'soft-shadow', imageRatio: 'square', hoverEffect: 'lift' },
    layout: {
      containerWidth: readInputString(layout.containerWidth, 'wide'),
      density: readInputString(layout.density, 'comfortable'),
      sectionSpacing: readInputString(layout.sectionSpacing, 'normal'),
    },
    background: { style: 'clean', pattern: 'none' },
  };
}

function getByPath(source: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, part) => asRecord(current)[part], source);
}

function setByPath(source: Record<string, unknown>, path: string, value: unknown): SettingsDraft {
  const next = JSON.parse(JSON.stringify(source)) as SettingsDraft;
  const parts = path.split('.');
  let cursor: Record<string, unknown> = next;
  parts.slice(0, -1).forEach((part) => {
    const existing = asRecord(cursor[part]);
    cursor[part] = existing;
    cursor = existing;
  });
  cursor[parts[parts.length - 1] ?? path] = value;
  return next;
}

function normalizeConfigPath(path: string): string {
  const [root] = path.split('.');
  return ['settings', 'globals', 'layout', 'accessibility', 'template'].includes(root ?? '') ? path : `settings.${path}`;
}

function readSchemaGroups(schema: Record<string, unknown>): Array<{ key: string; label?: string; fields: Array<{ key: string; field: SchemaField }> }> {
  const rawGroups = Array.isArray(schema.groups) ? schema.groups : [];
  if (rawGroups.length > 0) {
    return rawGroups
      .map((rawGroup, index) => {
        const group = asRecord(rawGroup);
        const fields = Array.isArray(group.fields) ? group.fields : [];
        return {
          key: readString(group.key, `group-${index}`),
          label: readString(group.label, ''),
          fields: fields
            .map((rawField) => {
              const field = asRecord(rawField) as SchemaField;
              const key = readString(field.key, '');
              return key ? { key, field } : null;
            })
            .filter((field): field is { key: string; field: SchemaField } => field !== null),
        };
      })
      .filter((group) => group.fields.length > 0);
  }

  const fields = Object.entries(schema)
    .filter(([key]) => key !== 'groups')
    .map(([key, rawField]) => ({ key, field: asRecord(rawField) as SchemaField }));
  return fields.length > 0 ? [{ key: 'settings', fields }] : [];
}

function filterSchemaForShell(schema: Record<string, unknown>): Record<string, unknown> {
  const groups = readSchemaGroups(schema)
    .map((group) => ({
      ...group,
      fields: group.fields.filter(({ key }) => /(header|footer|nav|menu|logo|social|link)/i.test(key)),
    }))
    .filter((group) => group.fields.length > 0);

  if (groups.length === 0) {
    return {};
  }

  return {
    groups: groups.map((group) => ({
      key: group.key,
      label: group.label,
      fields: group.fields.map(({ key, field }) => ({ ...field, key })),
    })),
  };
}

function isMerchantVisibleTemplate(template: ThemeTemplate): boolean {
  const production = asRecord(template.capabilities.production);
  const status = readString(production.status, '');
  if (status === 'hidden' || status === 'deprecated' || status === 'experimental') return false;
  if (['fashion-editorial', 'market-modern'].includes(template.templateKey) && status !== 'production_ready') return false;
  return true;
}

function sanitizeSectionDefinition(definition: HomeSectionDefinition): HomeSectionDefinition {
  const sourceTypes = definition.sourceTypes.filter((sourceType) => SUPPORTED_SOURCE_TYPES.includes(sourceType));
  const allowedVariants = SECTION_VARIANT_ALLOWLIST[definition.type];
  const variants = allowedVariants ? definition.variants.filter((variant) => allowedVariants.includes(variant)) : definition.variants;
  const defaultVariant = variants.includes(definition.defaultVariant) ? definition.defaultVariant : variants[0] ?? definition.defaultVariant;
  return {
    ...definition,
    variants: variants.length > 0 ? variants : [defaultVariant],
    defaultVariant,
    sourceTypes: sourceTypes.length > 0 ? sourceTypes : ['manual'],
  };
}

function sanitizeHomeSections(sections: HomeSection[], registry: HomeSectionDefinition[]): HomeSection[] {
  return sections.slice(0, MAX_SECTIONS).map((section) => {
    const definition = registry.find((item) => item.type === section.type);
    const variant = definition?.variants.includes(section.variant) ? section.variant : definition?.defaultVariant ?? section.variant;
    const sourceType = definition ? readSupportedSourceType(section, definition) : readString(asRecord(section.source).type, 'manual');
    const source = Object.keys(asRecord(section.source)).length > 0
      ? { ...asRecord(section.source), type: SUPPORTED_SOURCE_TYPES.includes(sourceType) ? sourceType : 'manual' }
      : undefined;
    return {
      ...section,
      variant,
      settings: sanitizeSectionSettings(section),
      ...(source ? { source } : {}),
    };
  });
}

function sanitizeSectionSettings(section: HomeSection): Record<string, unknown> {
  const settings = readConfigDraft(section.settings);
  if (section.type === 'promoBanners' || section.type === 'trustBadges') {
    settings.items = (Array.isArray(settings.items) ? settings.items : []).slice(0, MAX_REPEATER_ITEMS).map((item) => asRecord(item));
  }
  if (section.type === 'storeStory') {
    settings.stats = (Array.isArray(settings.stats) ? settings.stats : []).slice(0, MAX_REPEATER_ITEMS).map((item) => asRecord(item));
  }
  return settings;
}

function sanitizeDesignDraft(design: Record<string, unknown>): Record<string, unknown> {
  const next = readConfigDraft(design);
  const buttons = asRecord(next.buttons);
  if (Object.keys(buttons).length > 0) {
    next.buttons = { ...buttons, style: readButtonStyle(buttons.style) };
  }
  return next;
}

function deepMerge(...sources: Array<Record<string, unknown> | undefined>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const source of sources) {
    if (!source) continue;
    for (const [key, value] of Object.entries(source)) {
      const current = result[key];
      if (isPlainObject(current) && isPlainObject(value)) {
        result[key] = deepMerge(current, value);
      } else if (Array.isArray(value)) {
        result[key] = [...value];
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidHexColor(value: string): boolean {
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}

function isPartialHexColor(value: string): boolean {
  return /^#?[0-9a-fA-F]{0,6}$/.test(value.trim());
}

async function uploadMediaAsset(request: MerchantRequester, file: File): Promise<MediaAsset> {
  const presigned = await request<PresignedMediaUpload>('/media/presign-upload', {
    method: 'POST',
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type,
      fileSizeBytes: file.size,
    }),
  });

  if (!presigned) {
    throw new Error('تعذر الحصول على رابط الرفع');
  }

  const uploadResponse = await fetch(presigned.uploadUrl, {
    method: 'PUT',
    headers: presigned.uploadHeaders,
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error('فشل رفع الصورة');
  }

  const etag = uploadResponse.headers.get('etag') ?? undefined;
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

  if (!mediaAsset?.url) {
    throw new Error('تعذر تأكيد الصورة المرفوعة');
  }

  return mediaAsset;
}

function resolveStorefrontBaseUrl(apiBaseUrl: string, storeSlug: string | null): string {
  const configured = import.meta.env.VITE_STOREFRONT_URL_PATTERN ?? import.meta.env.VITE_STOREFRONT_BASE_URL;
  if (typeof configured === 'string' && configured.trim().length > 0 && storeSlug) {
    return configured.trim().replace('{storeSlug}', storeSlug).replace(/\/+$/, '');
  }
  try {
    const url = new URL(apiBaseUrl);
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      url.port = '3001';
      return url.toString().replace(/\/+$/, '');
    }
    if (url.hostname.startsWith('api.') && storeSlug) {
      url.hostname = `${storeSlug}.${url.hostname.slice(4)}`;
      url.port = '';
      return url.toString().replace(/\/+$/, '');
    }
  } catch {
    return buildDefaultStorefrontUrl(storeSlug);
  }
  return buildDefaultStorefrontUrl(storeSlug);
}

function buildPreviewUrl(storefrontBaseUrl: string, token: string, storeSlug: string | null): string {
  const params = new URLSearchParams({ token });
  if (storeSlug && allowsPreviewStoreQuery(storefrontBaseUrl)) params.set('store', storeSlug);
  return `${storefrontBaseUrl}/preview?${params.toString()}`;
}

function buildDefaultStorefrontUrl(storeSlug: string | null): string {
  return DEFAULT_STOREFRONT_URL_PATTERN.replace('{storeSlug}', storeSlug ?? '').replace(/\/+$/, '');
}

function allowsPreviewStoreQuery(storefrontBaseUrl: string): boolean {
  try {
    const hostname = new URL(storefrontBaseUrl).hostname.toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === 'stores.kaleemstores.com';
  } catch {
    return false;
  }
}

function formatCategory(category: ThemeTemplate['category']): string {
  const labels: Record<ThemeTemplate['category'], string> = {
    fashion: 'موضة',
    electronics: 'إلكترونيات',
    beauty: 'جمال',
    grocery: 'بقالة',
    luxury: 'فاخر',
    minimal: 'بسيط',
    restaurant: 'مطاعم',
    general: 'عام',
  };
  return labels[category] ?? category;
}

function readTemplateProduction(capabilities: Record<string, unknown>): { status: string; label: string; score: number } {
  const production = asRecord(capabilities.production);
  const status = readString(production.status, 'experimental');
  const score = readNumber(production.qualityScore, status === 'production_ready' ? 85 : 60);
  const labels: Record<string, string> = {
    production_ready: 'جاهز',
    beta: 'Beta',
    experimental: 'تجريبي',
    hidden: 'مخفي',
    deprecated: 'قديم',
  };
  return { status, label: labels[status] ?? status, score };
}

function readSupportedPageCount(capabilities: Record<string, unknown>): { completed: number; total: number } {
  const supportedPages = asRecord(capabilities.supportedPages);
  const required = ['home', 'categories', 'category', 'search', 'product', 'cart', 'checkout', 'orderTracking', 'staticPage', 'contact', 'notFound'];
  return {
    completed: required.filter((key) => supportedPages[key] === true).length,
    total: required.length,
  };
}

function readSupportedSourceType(section: HomeSection, definition: HomeSectionDefinition): string {
  const fallback = definition.sourceTypes[0] ?? 'manual';
  const sourceType = readString(asRecord(section.source).type, fallback);
  return definition.sourceTypes.includes(sourceType) ? sourceType : fallback;
}

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function readInputString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function readButtonStyle(value: unknown): string {
  if (value === 'outlined') return 'outline';
  if (value === 'gradient') return 'filled';
  return readInputString(value, 'filled');
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

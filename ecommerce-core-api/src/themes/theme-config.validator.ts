import { BadRequestException } from '@nestjs/common';
import {
  SUPPORTED_THEME_FONTS,
  THEME_BACKGROUND_STYLES,
  THEME_BODY_WEIGHTS,
  THEME_BUTTON_SIZES,
  THEME_BUTTON_STYLES,
  THEME_CARD_HOVER_EFFECTS,
  THEME_CARD_STYLES,
  THEME_CONTAINER_WIDTHS,
  THEME_DENSITIES,
  THEME_FONT_SCALES,
  THEME_HEADING_WEIGHTS,
  THEME_RADIUS_MODES,
  THEME_SECTION_SPACINGS,
} from './defaults/theme-design.defaults';

const MAX_THEME_CONFIG_BYTES = 64 * 1024;
const URL_SETTING_KEYS = new Set([
  'href',
  'url',
  'link',
  'ctaHref',
  'primaryCtaHref',
  'secondaryCtaHref',
  'mediaUrl',
  'imageUrl',
  'videoUrl',
]);
const SCRIPT_SETTING_KEYS = new Set(['script', 'scripts', 'customScript', 'html', 'customHtml']);
const SETTINGS_SCHEMA_FIELD_TYPES = new Set([
  'text',
  'textarea',
  'image',
  'number',
  'boolean',
  'select',
  'url',
  'color',
]);

export function validateThemeConfig(config: Record<string, unknown>): Record<string, unknown> {
  if (!isPlainObject(config)) {
    throw new BadRequestException('Theme config must be a valid object');
  }

  validatePayloadSize(config);
  validateNoUnsafeContent(config);

  if (config.schemaVersion !== 3) {
    throw new BadRequestException('Theme config schemaVersion must be 3');
  }

  if (Array.isArray(config.sections)) {
    throw new BadRequestException('Theme config sections[] is not supported in schemaVersion 3');
  }

  validateTemplateMetadata(config.template);

  const settings = config.settings;
  if (!isPlainObject(settings)) {
    throw new BadRequestException('Theme config settings must be a valid object');
  }

  validateThemeDesign(config.design);
  validatePages(config.pages);

  return normalizeAccessibilityConfig(config);
}

export interface ThemeAccessibilityIssue {
  code: string;
  severity: 'critical' | 'serious' | 'warning';
  message: string;
  path: string;
  contrastRatio?: number;
}

export interface ThemeAccessibilityAudit {
  score: number;
  wcagLevel: 'AA';
  issues: ThemeAccessibilityIssue[];
  auditedAt: string;
}

export function auditThemeAccessibility(config: Record<string, unknown>): ThemeAccessibilityAudit {
  const normalized = normalizeAccessibilityConfig(config);
  const color = readColorConfig(normalized);
  const checks = [
    ['globals.color.text', color.text, color.bg],
    ['globals.color.textMuted', color.textMuted, color.bg],
    ['globals.color.primaryContrast', color.primaryContrast, color.primary],
    ['globals.color.heroText', color.heroText, color.heroSecondary],
  ] as const;
  const issues: ThemeAccessibilityIssue[] = [];

  for (const [path, foreground, background] of checks) {
    const ratio = contrastRatio(foreground, background);
    if (ratio !== null && ratio < 4.5) {
      issues.push({
        code: 'contrast-aa',
        severity: ratio < 3 ? 'critical' : 'serious',
        message: `Color contrast at ${path} is ${ratio.toFixed(2)}:1 and must be at least 4.5:1.`,
        path,
        contrastRatio: Number(ratio.toFixed(2)),
      });
    }
  }

  const accessibility = isPlainObject(normalized.accessibility) ? normalized.accessibility : {};
  if (accessibility.strongFocusRing !== true) {
    issues.push({
      code: 'focus-visibility',
      severity: 'serious',
      message: 'Theme must keep a strong visible focus indicator enabled.',
      path: 'accessibility.strongFocusRing',
    });
  }
  if (accessibility.accessibleAnimations !== true && accessibility.reducedMotion !== true) {
    issues.push({
      code: 'reduced-motion-support',
      severity: 'serious',
      message: 'Theme must support reduced motion or accessible animations.',
      path: 'accessibility.reducedMotion',
    });
  }
  if (typeof accessibility.fontScale === 'number' && accessibility.fontScale < 1) {
    issues.push({
      code: 'minimum-font-size',
      severity: 'serious',
      message: 'Theme font scale cannot reduce text below the base readable size.',
      path: 'accessibility.fontScale',
    });
  }

  const settings = isPlainObject(normalized.settings) ? normalized.settings : {};
  if (hasColorOnlyIndicator(settings)) {
    issues.push({
      code: 'color-only-indicators',
      severity: 'serious',
      message: 'Theme settings appear to use color-only indicators; add text or icon alternatives.',
      path: 'settings',
    });
  }
  if (hasSmallTargetSize(settings)) {
    issues.push({
      code: 'target-size',
      severity: 'warning',
      message:
        'Interactive target sizes should be at least 24 by 24 CSS pixels, with 44 by 44 preferred.',
      path: 'settings',
    });
  }
  if (hasMissingAltText(settings)) {
    issues.push({
      code: 'alt-text-coverage',
      severity: 'serious',
      message: 'Meaningful theme images must include localized alt text or be marked decorative.',
      path: 'settings',
    });
  }

  const criticalCount = issues.filter((issue) => issue.severity === 'critical').length;
  const warningCount = issues.length - criticalCount;

  return {
    score: Math.max(0, 100 - criticalCount * 25 - warningCount * 8),
    wcagLevel: 'AA',
    issues,
    auditedAt: new Date().toISOString(),
  };
}

export function assertThemeAccessibility(config: Record<string, unknown>): ThemeAccessibilityAudit {
  const audit = auditThemeAccessibility(config);
  if (audit.issues.some((issue) => issue.severity === 'critical')) {
    throw new BadRequestException(
      'Theme has critical accessibility contrast issues and cannot be published',
    );
  }
  return audit;
}

function hasColorOnlyIndicator(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => hasColorOnlyIndicator(item));
  }
  if (!isPlainObject(value)) {
    return false;
  }
  if (value.colorOnly === true || value.usesColorOnly === true) {
    return true;
  }
  return Object.values(value).some((item) => hasColorOnlyIndicator(item));
}

function hasSmallTargetSize(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => hasSmallTargetSize(item));
  }
  if (!isPlainObject(value)) {
    return false;
  }
  const width = typeof value.targetWidth === 'number' ? value.targetWidth : undefined;
  const height = typeof value.targetHeight === 'number' ? value.targetHeight : undefined;
  if ((width !== undefined && width < 24) || (height !== undefined && height < 24)) {
    return true;
  }
  return Object.values(value).some((item) => hasSmallTargetSize(item));
}

function hasMissingAltText(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => hasMissingAltText(item));
  }
  if (!isPlainObject(value)) {
    return false;
  }
  const imageUrl = typeof value.imageUrl === 'string' ? value.imageUrl.trim() : '';
  const mediaUrl = typeof value.mediaUrl === 'string' ? value.mediaUrl.trim() : '';
  const decorative = value.decorative === true || value.isDecorative === true;
  const altAr = typeof value.altTextAr === 'string' ? value.altTextAr.trim() : '';
  const altEn = typeof value.altTextEn === 'string' ? value.altTextEn.trim() : '';
  const alt = typeof value.alt === 'string' ? value.alt.trim() : '';
  if ((imageUrl || mediaUrl) && !decorative && !alt && !altAr && !altEn) {
    return true;
  }
  return Object.values(value).some((item) => hasMissingAltText(item));
}

function normalizeAccessibilityConfig(config: Record<string, unknown>): Record<string, unknown> {
  const accessibility = isPlainObject(config.accessibility) ? config.accessibility : {};
  return {
    ...config,
    accessibility: {
      contrastMode: accessibility.contrastMode === 'high' ? 'high' : 'normal',
      reducedMotion: accessibility.reducedMotion === true,
      fontScale:
        typeof accessibility.fontScale === 'number' &&
        Number.isFinite(accessibility.fontScale) &&
        accessibility.fontScale >= 1 &&
        accessibility.fontScale <= 1.5
          ? accessibility.fontScale
          : 1,
      underlineLinks: accessibility.underlineLinks === true,
      strongFocusRing: accessibility.strongFocusRing !== false,
      accessibleAnimations: accessibility.accessibleAnimations !== false,
    },
  };
}

function readColorConfig(config: Record<string, unknown>): Record<string, string> {
  const design = isPlainObject(config.design) ? config.design : {};
  const designColors = isPlainObject(design.colors) ? design.colors : {};
  const globals = isPlainObject(config.globals) ? config.globals : {};
  const color = isPlainObject(globals.color) ? globals.color : {};
  return {
    bg: readColor(designColors.background ?? color.bg ?? globals.background, '#f5efe5'),
    text: readColor(designColors.text ?? color.text, '#2f2418'),
    textMuted: readColor(designColors.mutedText ?? color.textMuted, '#6d5b46'),
    primary: readColor(designColors.primary ?? color.primary ?? globals.primaryColor, '#295f55'),
    primaryContrast: readColor(designColors.primaryForeground ?? color.primaryContrast, '#f8f7f2'),
    heroText: readColor(color.heroText, '#f7efe4'),
    heroSecondary: readColor(color.heroSecondary, '#234966'),
  };
}

function readColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value.trim())
    ? value.trim()
    : fallback;
}

function contrastRatio(foreground: string, background: string): number | null {
  const fg = hexToRgb(foreground);
  const bg = hexToRgb(background);
  if (!fg || !bg) {
    return null;
  }
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function hexToRgb(hex: string): [number, number, number] | null {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!match) {
    return null;
  }
  const value = match[1];
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function relativeLuminance([red, green, blue]: [number, number, number]): number {
  const [r, g, b] = [red, green, blue].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function validatePayloadSize(config: Record<string, unknown>): void {
  const bytes = Buffer.byteLength(JSON.stringify(config), 'utf8');
  if (bytes > MAX_THEME_CONFIG_BYTES) {
    throw new BadRequestException(`Theme config cannot exceed ${MAX_THEME_CONFIG_BYTES} bytes`);
  }
}

function validateNoUnsafeContent(value: unknown, path = 'config'): void {
  if (typeof value === 'string') {
    validateSafeString(value, path);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => validateNoUnsafeContent(item, `${path}[${index}]`));
    return;
  }

  if (!isPlainObject(value)) {
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const nestedPath = `${path}.${key}`;
    if (
      SCRIPT_SETTING_KEYS.has(key) &&
      typeof nestedValue === 'string' &&
      nestedValue.trim().length > 0
    ) {
      throw new BadRequestException(
        `Theme setting ${nestedPath} cannot contain custom scripts or HTML`,
      );
    }

    if (typeof nestedValue === 'string' && URL_SETTING_KEYS.has(key)) {
      validateSafeUrl(nestedValue, nestedPath);
    }

    validateNoUnsafeContent(nestedValue, nestedPath);
  }
}

function validateSafeString(value: string, path: string): void {
  if (/<\/?[a-z][\s\S]*>/i.test(value)) {
    throw new BadRequestException(`Theme setting ${path} cannot contain HTML`);
  }

  if (/javascript\s*:|data\s*:/i.test(value)) {
    throw new BadRequestException(`Theme setting ${path} cannot contain unsafe URLs`);
  }
}

function validateSafeUrl(value: string, path: string): void {
  const trimmed = value.trim();
  if (!trimmed) {
    return;
  }

  if (/javascript\s*:|data\s*:/i.test(trimmed)) {
    throw new BadRequestException(`Theme setting ${path} cannot contain unsafe URLs`);
  }

  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new BadRequestException(`Theme setting ${path} must be a relative path or http(s) URL`);
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new BadRequestException(`Theme setting ${path} must use http(s)`);
  }

  if (
    parsed.protocol === 'http:' &&
    parsed.hostname !== 'localhost' &&
    parsed.hostname !== '127.0.0.1'
  ) {
    throw new BadRequestException(`Theme setting ${path} must use https for external URLs`);
  }
}

function validateTemplateMetadata(template: unknown): void {
  if (!isPlainObject(template)) {
    throw new BadRequestException('Theme template metadata must be a valid object');
  }

  if (!isValidText(template.id, 80)) {
    throw new BadRequestException('Theme template id must be a non-empty string up to 80 chars');
  }

  validateRangeInteger(
    template.version,
    1,
    9999,
    'Theme template version must be an integer between 1 and 9999',
  );

  if (template.renderer !== 'component') {
    throw new BadRequestException('Theme template renderer must be component');
  }

  if (!isValidText(template.componentKey, 80)) {
    throw new BadRequestException(
      'Theme template componentKey must be a non-empty string up to 80 chars',
    );
  }

  if (template.appliedAt !== undefined && !isValidText(template.appliedAt, 80)) {
    throw new BadRequestException(
      'Theme template appliedAt must be a non-empty string up to 80 chars',
    );
  }
}

function validateThemeDesign(design: unknown): void {
  if (design === undefined) {
    return;
  }
  if (!isPlainObject(design)) {
    throw new BadRequestException('Theme design must be a valid object');
  }

  const colors = design.colors;
  if (colors !== undefined) {
    if (!isPlainObject(colors)) {
      throw new BadRequestException('Theme design colors must be a valid object');
    }
    for (const [key, value] of Object.entries(colors)) {
      if (
        value !== undefined &&
        value !== null &&
        (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value.trim()))
      ) {
        throw new BadRequestException(`Theme design color ${key} must be a valid HEX color`);
      }
    }
  }

  const typography = design.typography;
  if (typography !== undefined && !isPlainObject(typography)) {
    throw new BadRequestException('Theme design typography must be a valid object');
  }
  if (isPlainObject(typography)) {
    validateAllowed(
      typography.headingFont,
      SUPPORTED_THEME_FONTS,
      'Theme design typography.headingFont is invalid',
    );
    validateAllowed(
      typography.bodyFont,
      SUPPORTED_THEME_FONTS,
      'Theme design typography.bodyFont is invalid',
    );
    validateAllowed(
      typography.fontScale,
      THEME_FONT_SCALES,
      'Theme design typography.fontScale is invalid',
    );
    validateAllowed(
      typography.headingWeight,
      THEME_HEADING_WEIGHTS,
      'Theme design typography.headingWeight is invalid',
    );
    validateAllowed(
      typography.bodyWeight,
      THEME_BODY_WEIGHTS,
      'Theme design typography.bodyWeight is invalid',
    );
  }
  const radius = design.radius;
  if (radius !== undefined && !isPlainObject(radius)) {
    throw new BadRequestException('Theme design radius must be a valid object');
  }
  if (isPlainObject(radius)) {
    validateAllowed(radius.mode, THEME_RADIUS_MODES, 'Theme design radius.mode is invalid');
  }
  const buttons = design.buttons;
  if (buttons !== undefined && !isPlainObject(buttons)) {
    throw new BadRequestException('Theme design buttons must be a valid object');
  }
  if (isPlainObject(buttons)) {
    validateAllowed(buttons.style, THEME_BUTTON_STYLES, 'Theme design buttons.style is invalid');
    validateAllowed(buttons.size, THEME_BUTTON_SIZES, 'Theme design buttons.size is invalid');
  }
  const cards = design.cards;
  if (cards !== undefined && !isPlainObject(cards)) {
    throw new BadRequestException('Theme design cards must be a valid object');
  }
  if (isPlainObject(cards)) {
    validateAllowed(cards.style, THEME_CARD_STYLES, 'Theme design cards.style is invalid');
    validateAllowed(
      cards.hoverEffect,
      THEME_CARD_HOVER_EFFECTS,
      'Theme design cards.hoverEffect is invalid',
    );
  }
  const layout = design.layout;
  if (layout !== undefined && !isPlainObject(layout)) {
    throw new BadRequestException('Theme design layout must be a valid object');
  }
  if (isPlainObject(layout)) {
    validateAllowed(layout.density, THEME_DENSITIES, 'Theme design layout.density is invalid');
    validateAllowed(
      layout.sectionSpacing,
      THEME_SECTION_SPACINGS,
      'Theme design layout.sectionSpacing is invalid',
    );
    validateAllowed(
      layout.containerWidth,
      THEME_CONTAINER_WIDTHS,
      'Theme design layout.containerWidth is invalid',
    );
  }
  const background = design.background;
  if (background !== undefined && !isPlainObject(background)) {
    throw new BadRequestException('Theme design background must be a valid object');
  }
  if (isPlainObject(background)) {
    validateAllowed(
      background.style,
      THEME_BACKGROUND_STYLES,
      'Theme design background.style is invalid',
    );
  }
}

function validateAllowed(value: unknown, allowed: readonly string[], message: string): void {
  if (value !== undefined && (typeof value !== 'string' || !allowed.includes(value))) {
    throw new BadRequestException(message);
  }
}

function validatePages(pages: unknown): void {
  if (pages === undefined) {
    return;
  }
  if (!isPlainObject(pages)) {
    throw new BadRequestException('Theme config pages must be a valid object');
  }
  const home = pages.home;
  if (home === undefined) {
    return;
  }
  if (!isPlainObject(home)) {
    throw new BadRequestException('Theme config pages.home must be a valid object');
  }
  if (home.sections !== undefined && !Array.isArray(home.sections)) {
    throw new BadRequestException('Theme config pages.home.sections must be an array');
  }
}

function validateRangeInteger(
  value: unknown,
  min: number,
  max: number,
  errorMessage: string,
): void {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new BadRequestException(errorMessage);
  }
}

function isValidText(value: unknown, maxLength: number): boolean {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  return !Array.isArray(value);
}

export function validateThemeSettingsSchema(
  schema: Record<string, unknown>,
): Record<string, unknown> {
  if (!isPlainObject(schema)) {
    throw new BadRequestException('Theme settings schema must be a valid object');
  }

  for (const [key, value] of Object.entries(schema)) {
    if (!isValidText(key, 120) || !/^[a-zA-Z0-9_.-]+$/.test(key)) {
      throw new BadRequestException('Theme settings schema key is invalid');
    }
    if (!isPlainObject(value)) {
      throw new BadRequestException(`Theme settings schema field ${key} must be an object`);
    }
    if (typeof value.type !== 'string' || !SETTINGS_SCHEMA_FIELD_TYPES.has(value.type)) {
      throw new BadRequestException(`Theme settings schema field ${key} type is invalid`);
    }
    if (!isValidText(value.label, 120)) {
      throw new BadRequestException(`Theme settings schema field ${key} label is invalid`);
    }
  }

  return schema;
}

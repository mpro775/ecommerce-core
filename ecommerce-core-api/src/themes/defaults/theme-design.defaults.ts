export type ThemeDesign = Record<string, unknown>;

export interface ThemeDesignPreset {
  key: string;
  name: string;
  category: string;
  design: ThemeDesign;
  preview: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
  };
}

export type ContrastStatus = 'pass' | 'warning' | 'fail';

export const SUPPORTED_THEME_FONTS = [
  'Cairo',
  'Tajawal',
  'Alexandria',
  'IBM Plex Sans Arabic',
  'Noto Kufi Arabic',
  'Noto Sans Arabic',
  'Inter',
  'Arial',
] as const;
export const THEME_BUTTON_STYLES = ['filled', 'outline', 'soft', 'ghost'] as const;
export const THEME_BUTTON_SIZES = ['compact', 'comfortable', 'large'] as const;
export const THEME_CARD_STYLES = [
  'flat',
  'bordered',
  'soft-shadow',
  'strong-shadow',
  'luxury',
  'warm-shadow',
  'fresh-shadow',
] as const;
export const THEME_CARD_HOVER_EFFECTS = ['none', 'lift', 'shadow', 'glow', 'fade'] as const;
export const THEME_RADIUS_MODES = [
  'sharp',
  'medium',
  'soft',
  'rounded',
  'luxury',
  'friendly',
  'minimal',
] as const;
export const THEME_DENSITIES = ['compact', 'comfortable', 'spacious'] as const;
export const THEME_SECTION_SPACINGS = ['small', 'normal', 'large'] as const;
export const THEME_CONTAINER_WIDTHS = ['compact', 'normal', 'wide'] as const;
export const THEME_BACKGROUND_STYLES = [
  'clean',
  'soft-gradient',
  'subtle-pattern',
  'warm-surface',
] as const;
export const THEME_FONT_SCALES = ['compact', 'normal', 'large'] as const;
export const THEME_HEADING_WEIGHTS = ['medium', 'semibold', 'bold', 'extrabold'] as const;
export const THEME_BODY_WEIGHTS = ['regular', 'medium'] as const;

export interface ThemeContrastResult {
  pair: string;
  ratio: number | null;
  status: ContrastStatus;
}

export const DEFAULT_THEME_DESIGN: ThemeDesign = {
  preset: 'default-clean',
  colors: {
    primary: '#2563eb',
    primaryForeground: '#ffffff',
    secondary: '#f97316',
    secondaryForeground: '#ffffff',
    accent: '#10b981',
    background: '#f8fafc',
    surface: '#ffffff',
    surfaceMuted: '#f1f5f9',
    text: '#0f172a',
    mutedText: '#64748b',
    border: '#e2e8f0',
    success: '#16a34a',
    warning: '#f59e0b',
    danger: '#dc2626',
  },
  typography: {
    headingFont: 'Cairo',
    bodyFont: 'Cairo',
    fontScale: 'normal',
    headingWeight: 'bold',
    bodyWeight: 'regular',
  },
  radius: {
    mode: 'soft',
    button: '999px',
    card: '24px',
    input: '16px',
    image: '20px',
  },
  buttons: {
    style: 'filled',
    size: 'comfortable',
    uppercase: false,
  },
  cards: {
    style: 'soft-shadow',
    imageRatio: 'square',
    hoverEffect: 'lift',
  },
  layout: {
    containerWidth: 'wide',
    density: 'comfortable',
    sectionSpacing: 'normal',
  },
  background: {
    style: 'clean',
    pattern: 'none',
  },
};

export const THEME_DESIGN_PRESETS: ThemeDesignPreset[] = [
  {
    key: 'default-clean',
    name: 'Default Clean',
    category: 'general',
    design: {
      preset: 'default-clean',
      colors: {
        primary: '#2563eb',
        primaryForeground: '#ffffff',
        secondary: '#f97316',
        secondaryForeground: '#ffffff',
        accent: '#10b981',
        background: '#f8fafc',
        surface: '#ffffff',
        surfaceMuted: '#f1f5f9',
        text: '#0f172a',
        mutedText: '#64748b',
        border: '#e2e8f0',
      },
      radius: { mode: 'soft', button: '999px', card: '24px', input: '16px', image: '20px' },
      cards: { style: 'soft-shadow', hoverEffect: 'lift' },
    },
    preview: {
      primary: '#2563eb',
      secondary: '#f97316',
      background: '#f8fafc',
      surface: '#ffffff',
      text: '#0f172a',
    },
  },
  {
    key: 'modern-tech',
    name: 'Modern Tech',
    category: 'electronics',
    design: {
      preset: 'modern-tech',
      colors: {
        primary: '#0f172a',
        primaryForeground: '#ffffff',
        secondary: '#2563eb',
        secondaryForeground: '#ffffff',
        accent: '#38bdf8',
        background: '#f8fafc',
        surface: '#ffffff',
        text: '#0f172a',
        mutedText: '#64748b',
        border: '#e2e8f0',
      },
      radius: { mode: 'medium', button: '14px', card: '20px', input: '14px', image: '18px' },
      cards: { style: 'bordered', hoverEffect: 'lift' },
    },
    preview: {
      primary: '#0f172a',
      secondary: '#2563eb',
      background: '#f8fafc',
      surface: '#ffffff',
      text: '#0f172a',
    },
  },
  {
    key: 'beauty-luxe',
    name: 'Beauty Luxe',
    category: 'beauty',
    design: {
      preset: 'beauty-luxe',
      colors: {
        primary: '#be185d',
        primaryForeground: '#ffffff',
        secondary: '#f9a8d4',
        secondaryForeground: '#831843',
        accent: '#f59e0b',
        background: '#fff7fb',
        surface: '#ffffff',
        text: '#3b0a24',
        mutedText: '#8a536e',
        border: '#fbcfe8',
      },
      radius: { mode: 'luxury', button: '999px', card: '28px', input: '18px', image: '28px' },
      cards: { style: 'soft-shadow', hoverEffect: 'glow' },
    },
    preview: {
      primary: '#be185d',
      secondary: '#f9a8d4',
      background: '#fff7fb',
      surface: '#ffffff',
      text: '#3b0a24',
    },
  },
  {
    key: 'warm-local',
    name: 'Warm Local',
    category: 'local',
    design: {
      preset: 'warm-local',
      colors: {
        primary: '#9a3412',
        primaryForeground: '#ffffff',
        secondary: '#f97316',
        secondaryForeground: '#ffffff',
        accent: '#eab308',
        background: '#fff7ed',
        surface: '#ffffff',
        text: '#431407',
        mutedText: '#92400e',
        border: '#fed7aa',
      },
      radius: { mode: 'soft', button: '18px', card: '24px', input: '16px', image: '22px' },
      cards: { style: 'warm-shadow', hoverEffect: 'lift' },
    },
    preview: {
      primary: '#9a3412',
      secondary: '#f97316',
      background: '#fff7ed',
      surface: '#ffffff',
      text: '#431407',
    },
  },
  {
    key: 'minimal-black',
    name: 'Minimal Black',
    category: 'fashion',
    design: {
      preset: 'minimal-black',
      colors: {
        primary: '#111827',
        primaryForeground: '#ffffff',
        secondary: '#6b7280',
        secondaryForeground: '#ffffff',
        accent: '#d4af37',
        background: '#f9fafb',
        surface: '#ffffff',
        text: '#111827',
        mutedText: '#6b7280',
        border: '#e5e7eb',
      },
      radius: { mode: 'sharp', button: '8px', card: '10px', input: '8px', image: '10px' },
      cards: { style: 'bordered', hoverEffect: 'none' },
    },
    preview: {
      primary: '#111827',
      secondary: '#6b7280',
      background: '#f9fafb',
      surface: '#ffffff',
      text: '#111827',
    },
  },
  {
    key: 'fresh-market',
    name: 'Fresh Market',
    category: 'grocery',
    design: {
      preset: 'fresh-market',
      colors: {
        primary: '#15803d',
        primaryForeground: '#ffffff',
        secondary: '#84cc16',
        secondaryForeground: '#1a2e05',
        accent: '#f59e0b',
        background: '#f7fee7',
        surface: '#ffffff',
        text: '#14532d',
        mutedText: '#4d7c0f',
        border: '#bbf7d0',
      },
      radius: { mode: 'friendly', button: '16px', card: '20px', input: '14px', image: '18px' },
      cards: { style: 'soft-shadow', hoverEffect: 'lift' },
    },
    preview: {
      primary: '#15803d',
      secondary: '#84cc16',
      background: '#f7fee7',
      surface: '#ffffff',
      text: '#14532d',
    },
  },
];

export function findThemeDesignPreset(presetKey: string): ThemeDesignPreset | null {
  return THEME_DESIGN_PRESETS.find((preset) => preset.key === presetKey) ?? null;
}

export function deepMergeThemeDesign(...sources: ThemeDesign[]): ThemeDesign {
  const result: ThemeDesign = {};
  for (const source of sources) {
    for (const [key, value] of Object.entries(source)) {
      const existing = result[key];
      if (isPlainObject(existing) && isPlainObject(value)) {
        result[key] = deepMergeThemeDesign(existing, value);
      } else if (Array.isArray(value)) {
        result[key] = [...value];
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}

export function resolveThemeDesign(config: Record<string, unknown>): ThemeDesign {
  const explicit = isPlainObject(config.design) ? config.design : {};
  const globals = isPlainObject(config.globals) ? config.globals : {};
  const color = isPlainObject(globals.color) ? globals.color : {};
  const typography = isPlainObject(globals.typography) ? globals.typography : {};
  const radius = isPlainObject(globals.radius) ? globals.radius : {};
  const layout = isPlainObject(config.layout) ? config.layout : {};

  const legacy: ThemeDesign = {
    colors: {
      primary: color.primary ?? globals.primaryColor,
      primaryForeground: color.primaryContrast,
      secondary: color.accent ?? globals.accentColor,
      secondaryForeground: color.accentContrast,
      accent: color.accent,
      background: color.bg ?? globals.background,
      surface: color.surface,
      surfaceMuted: color.bgSoft,
      text: color.text,
      mutedText: color.textMuted,
      border: color.line,
      success: color.success,
      warning: color.warning,
      danger: color.danger,
    },
    typography: {
      headingFont: typography.headingFont ?? typography.headingFontFamily,
      bodyFont: typography.bodyFont ?? typography.bodyFontFamily ?? globals.fontFamily,
    },
    radius: {
      button: radius.button,
      card: radius.card,
      input: radius.input,
      image: radius.image,
    },
    layout: {
      containerWidth: layout.containerWidth,
      density: layout.density,
      sectionSpacing: layout.sectionSpacing,
    },
  };

  return normalizeThemeDesignContract(
    deepMergeThemeDesign(DEFAULT_THEME_DESIGN, stripUndefined(legacy), explicit),
  );
}

export function normalizeThemeDesignContract(design: ThemeDesign): ThemeDesign {
  const normalized = deepMergeThemeDesign(
    DEFAULT_THEME_DESIGN,
    isPlainObject(design) ? design : {},
  );
  const typography = isPlainObject(normalized.typography) ? { ...normalized.typography } : {};
  const radius = isPlainObject(normalized.radius) ? { ...normalized.radius } : {};
  const buttons = isPlainObject(normalized.buttons) ? { ...normalized.buttons } : {};
  const cards = isPlainObject(normalized.cards) ? { ...normalized.cards } : {};
  const layout = isPlainObject(normalized.layout) ? { ...normalized.layout } : {};
  const background = isPlainObject(normalized.background) ? { ...normalized.background } : {};

  buttons.style = mapButtonStyle(buttons.style);
  buttons.size = readAllowed(
    buttons.size,
    THEME_BUTTON_SIZES,
    (DEFAULT_THEME_DESIGN.buttons as Record<string, unknown>).size,
  );
  cards.style = readAllowed(
    cards.style,
    THEME_CARD_STYLES,
    (DEFAULT_THEME_DESIGN.cards as Record<string, unknown>).style,
  );
  cards.hoverEffect = readAllowed(
    cards.hoverEffect,
    THEME_CARD_HOVER_EFFECTS,
    (DEFAULT_THEME_DESIGN.cards as Record<string, unknown>).hoverEffect,
  );
  radius.mode = mapRadiusMode(radius.mode);
  layout.density = readAllowed(
    layout.density,
    THEME_DENSITIES,
    (DEFAULT_THEME_DESIGN.layout as Record<string, unknown>).density,
  );
  layout.sectionSpacing = readAllowed(
    layout.sectionSpacing,
    THEME_SECTION_SPACINGS,
    (DEFAULT_THEME_DESIGN.layout as Record<string, unknown>).sectionSpacing,
  );
  layout.containerWidth = readAllowed(
    layout.containerWidth,
    THEME_CONTAINER_WIDTHS,
    (DEFAULT_THEME_DESIGN.layout as Record<string, unknown>).containerWidth,
  );
  background.style = mapBackgroundStyle(background.style);
  typography.fontScale = readAllowed(
    typography.fontScale,
    THEME_FONT_SCALES,
    (DEFAULT_THEME_DESIGN.typography as Record<string, unknown>).fontScale,
  );
  typography.headingWeight = readAllowed(
    typography.headingWeight,
    THEME_HEADING_WEIGHTS,
    (DEFAULT_THEME_DESIGN.typography as Record<string, unknown>).headingWeight,
  );
  typography.bodyWeight = readAllowed(
    typography.bodyWeight,
    THEME_BODY_WEIGHTS,
    (DEFAULT_THEME_DESIGN.typography as Record<string, unknown>).bodyWeight,
  );
  typography.headingFont = readAllowed(
    typography.headingFont,
    SUPPORTED_THEME_FONTS,
    (DEFAULT_THEME_DESIGN.typography as Record<string, unknown>).headingFont,
  );
  typography.bodyFont = readAllowed(
    typography.bodyFont,
    SUPPORTED_THEME_FONTS,
    (DEFAULT_THEME_DESIGN.typography as Record<string, unknown>).bodyFont,
  );

  return { ...normalized, typography, radius, buttons, cards, layout, background };
}

function mapButtonStyle(value: unknown): string {
  if (value === 'outlined') return 'outline';
  if (value === 'gradient') return 'filled';
  return readAllowed(
    value,
    THEME_BUTTON_STYLES,
    (DEFAULT_THEME_DESIGN.buttons as Record<string, unknown>).style,
  );
}

function mapBackgroundStyle(value: unknown): string {
  if (value === 'solid') return 'clean';
  if (value === 'pattern' || value === 'subtle') return 'subtle-pattern';
  return readAllowed(
    value,
    THEME_BACKGROUND_STYLES,
    (DEFAULT_THEME_DESIGN.background as Record<string, unknown>).style,
  );
}

function mapRadiusMode(value: unknown): string {
  if (value === 'none') return 'minimal';
  return readAllowed(
    value,
    THEME_RADIUS_MODES,
    (DEFAULT_THEME_DESIGN.radius as Record<string, unknown>).mode,
  );
}

function readAllowed<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallback: unknown,
): T[number] {
  return typeof value === 'string' && allowed.includes(value) ? value : (fallback as T[number]);
}

export function validateThemeDesignContrast(
  colors: Record<string, unknown>,
): ThemeContrastResult[] {
  const pairs = [
    ['primary/primaryForeground', colors.primary, colors.primaryForeground],
    ['secondary/secondaryForeground', colors.secondary, colors.secondaryForeground],
    ['surface/text', colors.surface, colors.text],
    ['background/text', colors.background, colors.text],
    ['surfaceMuted/mutedText', colors.surfaceMuted, colors.mutedText],
  ] as const;

  return pairs.map(([pair, background, foreground]) => {
    const ratio = contrastRatio(readHex(foreground), readHex(background));
    return {
      pair,
      ratio: ratio === null ? null : Number(ratio.toFixed(2)),
      status: ratio === null ? 'warning' : ratio >= 4.5 ? 'pass' : ratio >= 3 ? 'warning' : 'fail',
    };
  });
}

function stripUndefined(value: ThemeDesign): ThemeDesign {
  const result: ThemeDesign = {};
  for (const [key, nested] of Object.entries(value)) {
    if (nested === undefined) {
      continue;
    }
    if (isPlainObject(nested)) {
      const cleaned = stripUndefined(nested);
      if (Object.keys(cleaned).length > 0) {
        result[key] = cleaned;
      }
      continue;
    }
    result[key] = nested;
  }
  return result;
}

function readHex(value: unknown): string | null {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value.trim()) ? value.trim() : null;
}

function contrastRatio(foreground: string | null, background: string | null): number | null {
  const fg = foreground ? hexToRgb(foreground) : null;
  const bg = background ? hexToRgb(background) : null;
  if (!fg || !bg) {
    return null;
  }
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function hexToRgb(hex: string): [number, number, number] | null {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!match) {
    return null;
  }
  return [
    Number.parseInt(match[1].slice(0, 2), 16),
    Number.parseInt(match[1].slice(2, 4), 16),
    Number.parseInt(match[1].slice(4, 6), 16),
  ];
}

function relativeLuminance([red, green, blue]: [number, number, number]): number {
  const [r, g, b] = [red, green, blue].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

import {
  DEFAULT_THEME_DESIGN,
  deepMergeThemeDesign,
  normalizeThemeDesignContract,
} from '../defaults/theme-design.defaults';
import { DEFAULT_HOME_SECTIONS, validateHomeSections } from '../theme-home-sections';
import { validateThemeConfig } from '../theme-config.validator';

export type NormalizedThemeConfig = Record<string, unknown> & {
  schemaVersion: number;
  design: Record<string, unknown>;
  pages: { home: { sections: unknown[] } };
  settings: Record<string, unknown>;
};

export const DEFAULT_THEME_CONFIG: NormalizedThemeConfig = {
  schemaVersion: 3,
  template: {
    id: 'general-starter',
    key: 'general-starter',
    type: 'component',
    renderer: 'component',
    componentKey: 'general-starter',
    name: 'General Starter',
    version: 3,
  },
  globals: {
    color: {
      primary: '#0f766e',
      primaryStrong: '#115e59',
      primaryContrast: '#ffffff',
      accent: '#f97316',
      bg: '#f8fafc',
      surface: '#ffffff',
      text: '#0f172a',
      textMuted: '#64748b',
      line: '#e2e8f0',
      success: '#16a34a',
      warning: '#f59e0b',
    },
  },
  design: DEFAULT_THEME_DESIGN,
  settings: {
    appearance: { headerStyle: 'clean', cardRadius: 'soft' },
    hero: {
      eyebrow: 'Ready storefront',
      headline: 'Discover our best products',
      subheadline: 'A stable storefront theme with products, categories, and trust signals.',
      primaryCtaLabel: 'Browse products',
      primaryCtaHref: '/categories',
      imageUrl: '',
    },
    products: { source: 'featured', limit: 8 },
  },
  pages: {
    home: {
      sections: validateHomeSections(DEFAULT_HOME_SECTIONS),
    },
  },
  layout: {},
  accessibility: { reducedMotion: false },
};

export function normalizeThemeConfig(config: unknown): NormalizedThemeConfig {
  const source = isPlainObject(config) ? cloneRecord(config) : cloneRecord(DEFAULT_THEME_CONFIG);
  const fallback = cloneRecord(DEFAULT_THEME_CONFIG);
  const legacyHomeSections = Array.isArray(source.homeSections) ? source.homeSections : undefined;
  const pages = isPlainObject(source.pages) ? source.pages : {};
  const home = isPlainObject(pages.home) ? pages.home : {};
  const sections = Array.isArray(home.sections)
    ? home.sections
    : (legacyHomeSections ?? fallback.pages.home.sections);

  const normalized: Record<string, unknown> = {
    ...source,
    schemaVersion: source.schemaVersion ?? fallback.schemaVersion,
    template: isPlainObject(source.template) ? source.template : fallback.template,
    design: normalizeThemeDesignContract(
      deepMergeThemeDesign(DEFAULT_THEME_DESIGN, isPlainObject(source.design) ? source.design : {}),
    ),
    pages: {
      ...pages,
      home: {
        ...home,
        sections: validateHomeSections(sections),
      },
    },
    settings: isPlainObject(source.settings) ? source.settings : fallback.settings,
  };

  delete normalized.homeSections;

  return validateThemeConfig(normalized) as NormalizedThemeConfig;
}

export function setHomeSectionsInConfig(
  config: unknown,
  sections: unknown[],
): NormalizedThemeConfig {
  const normalized = normalizeThemeConfig(config);
  return normalizeThemeConfig({
    ...normalized,
    pages: {
      ...normalized.pages,
      home: {
        ...normalized.pages.home,
        sections,
      },
    },
  });
}

function cloneRecord<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

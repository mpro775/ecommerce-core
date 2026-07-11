import { BadRequestException } from '@nestjs/common';

export type ThemeSectionType =
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

export type ThemeSectionSourceType =
  | 'manual'
  | 'featured'
  | 'latest'
  | 'category'
  | 'selectedProducts'
  | 'selectedCategories';

export interface ThemeHomeSectionDefinition {
  type: ThemeSectionType;
  label: string;
  description: string;
  variants: string[];
  defaultVariant: string;
  sourceTypes: ThemeSectionSourceType[];
  defaultSettings: Record<string, unknown>;
  defaultSource?: Record<string, unknown>;
  locked?: boolean;
  repeatable?: boolean;
}

export interface ThemePageSection {
  id: string;
  type: ThemeSectionType;
  variant: string;
  enabled: boolean;
  locked?: boolean;
  settings: Record<string, unknown>;
  source?: Record<string, unknown>;
  visibility?: Record<string, unknown>;
}

export const HOME_SECTION_REGISTRY: ThemeHomeSectionDefinition[] = [
  {
    type: 'hero',
    label: 'Hero',
    description: 'Main opening section for the home page.',
    variants: ['split', 'centered', 'banner', 'minimal', 'electronics', 'beauty'],
    defaultVariant: 'split',
    sourceTypes: ['manual'],
    locked: true,
    defaultSettings: {
      headline: 'اكتشف أفضل اختيارات متجرنا',
      subheadline: 'واجهة متجر حديثة تعرض المنتجات المهمة والتصنيفات والثقة الشرائية من أول زيارة.',
      imageUrl: '',
      backgroundImageUrl: '',
      ctaLabel: 'تسوق الآن',
      ctaHref: '/categories',
      secondaryCtaLabel: 'تصفح التصنيفات',
      secondaryCtaHref: '/categories',
      showSearch: true,
    },
  },
  {
    type: 'categories',
    label: 'Categories',
    description: 'Show important storefront categories.',
    variants: ['cards', 'icons', 'carousel', 'grid', 'strip'],
    defaultVariant: 'cards',
    sourceTypes: ['selectedCategories', 'latest', 'manual'],
    repeatable: true,
    defaultSettings: {
      title: 'تسوق حسب التصنيف',
      subtitle: 'اختر القسم المناسب لك',
      limit: 8,
      showViewAll: true,
      viewAllHref: '/categories',
    },
    defaultSource: { type: 'latest', limit: 8 },
  },
  {
    type: 'products',
    label: 'Products',
    description: 'Show products from a configured source.',
    variants: ['grid', 'carousel', 'compact', 'featured', 'deals'],
    defaultVariant: 'grid',
    sourceTypes: ['featured', 'latest', 'category', 'selectedProducts'],
    repeatable: true,
    defaultSettings: {
      title: 'منتجات مميزة',
      subtitle: 'مختارات خاصة من المتجر',
      limit: 12,
      showViewAll: true,
      viewAllHref: '/categories',
      showPrice: true,
      showQuickAdd: true,
    },
    defaultSource: { type: 'featured', limit: 12 },
  },
  {
    type: 'promoBanners',
    label: 'Promo Banners',
    description: 'Manual promotional banners.',
    variants: ['single', 'twoColumns', 'threeCards', 'wide', 'masonry'],
    defaultVariant: 'twoColumns',
    sourceTypes: ['manual'],
    repeatable: true,
    defaultSettings: {
      title: 'عروض خاصة',
      items: [
        {
          title: 'خصم على المنتجات المختارة',
          description: 'عروض لفترة محدودة',
          imageUrl: '',
          href: '/categories',
          ctaLabel: 'اكتشف العرض',
        },
      ],
    },
  },
  {
    type: 'brands',
    label: 'Brands',
    description: 'Show available product brands.',
    variants: ['logos', 'carousel', 'grid', 'minimal'],
    defaultVariant: 'logos',
    sourceTypes: ['manual', 'latest'],
    repeatable: true,
    defaultSettings: {
      title: 'البراندات المتوفرة',
      subtitle: 'تسوق من أشهر العلامات',
      limit: 12,
      showViewAll: true,
      viewAllHref: '/categories',
    },
    defaultSource: { type: 'latest', limit: 12 },
  },
  {
    type: 'storeStory',
    label: 'Store Story',
    description: 'Store story, trust and mission section.',
    variants: ['textImage', 'centered', 'stats', 'minimal'],
    defaultVariant: 'textImage',
    sourceTypes: ['manual'],
    repeatable: true,
    defaultSettings: {
      title: 'من نحن',
      description: 'نقدم أفضل المنتجات بعناية وجودة عالية.',
      imageUrl: '',
      ctaLabel: 'اعرف المزيد',
      ctaHref: '/pages/about',
      stats: [
        { label: 'منتج', value: '+500' },
        { label: 'عميل', value: '+1000' },
      ],
    },
  },
  {
    type: 'trustBadges',
    label: 'Trust Badges',
    description: 'Trust badges and service promises.',
    variants: ['icons', 'cards', 'strip'],
    defaultVariant: 'icons',
    sourceTypes: ['manual'],
    repeatable: true,
    defaultSettings: {
      items: [
        { title: 'دفع آمن', description: 'خيارات دفع موثوقة', icon: 'shield' },
        { title: 'توصيل سريع', description: 'خيارات توصيل مرنة', icon: 'truck' },
        { title: 'دعم العملاء', description: 'نحن هنا لمساعدتك', icon: 'support' },
      ],
    },
  },
  {
    type: 'contactStrip',
    label: 'Contact Strip',
    description: 'Contact call to action.',
    variants: ['simple', 'cta', 'infoCards'],
    defaultVariant: 'cta',
    sourceTypes: ['manual'],
    repeatable: true,
    defaultSettings: {
      title: 'تحتاج مساعدة؟',
      description: 'تواصل معنا وسنساعدك في اختيار المنتج المناسب.',
      phone: '',
      whatsapp: '',
      email: '',
      ctaLabel: 'تواصل معنا',
      ctaHref: '/pages/contact',
    },
  },
  {
    type: 'newsletter',
    label: 'Newsletter',
    description: 'Newsletter capture section.',
    variants: ['simple', 'card', 'wide'],
    defaultVariant: 'simple',
    sourceTypes: ['manual'],
    repeatable: true,
    defaultSettings: {
      title: 'اشترك ليصلك الجديد',
      description: 'تابع أحدث العروض والمنتجات.',
      placeholder: 'البريد الإلكتروني',
      ctaLabel: 'اشتراك',
    },
  },
  {
    type: 'customContent',
    label: 'Custom Content',
    description: 'Safe custom text content.',
    variants: ['text', 'quote', 'split'],
    defaultVariant: 'text',
    sourceTypes: ['manual'],
    repeatable: true,
    defaultSettings: {
      title: 'محتوى مخصص',
      body: 'اكتب رسالة قصيرة تظهر في الصفحة الرئيسية.',
    },
  },
];

const REGISTRY_BY_TYPE = new Map(HOME_SECTION_REGISTRY.map((item) => [item.type, item]));
const MAX_HOME_SECTIONS = 24;

export const DEFAULT_HOME_SECTIONS: ThemePageSection[] = [
  createDefaultHomeSection('hero', 'hero-main'),
  createDefaultHomeSection('categories', 'categories-main'),
  createDefaultHomeSection('products', 'featured-products'),
  createDefaultHomeSection('promoBanners', 'promo-banners'),
  createDefaultHomeSection('trustBadges', 'trust-badges'),
  createDefaultHomeSection('storeStory', 'store-story'),
];

export function createDefaultHomeSection(type: ThemeSectionType, id?: string): ThemePageSection {
  const definition = getHomeSectionDefinition(type);
  return {
    id: id ?? `${type}-${Date.now()}`,
    type,
    variant: definition.defaultVariant,
    enabled: true,
    locked: definition.locked === true,
    settings: cloneRecord(definition.defaultSettings),
    ...(definition.defaultSource ? { source: cloneRecord(definition.defaultSource) } : {}),
  };
}

export function getHomeSectionRegistry() {
  return {
    items: HOME_SECTION_REGISTRY.map((definition) => ({
      ...definition,
      defaultSettings: cloneRecord(definition.defaultSettings),
      ...(definition.defaultSource ? { defaultSource: cloneRecord(definition.defaultSource) } : {}),
    })),
  };
}

export function ensureHomeSections(config: Record<string, unknown>): Record<string, unknown> {
  const pages = isPlainObject(config.pages) ? config.pages : {};
  const home = isPlainObject(pages.home) ? pages.home : {};
  const sections = Array.isArray(home.sections)
    ? home.sections
    : Array.isArray(config.homeSections)
      ? config.homeSections
      : DEFAULT_HOME_SECTIONS;
  const normalized: Record<string, unknown> = {
    ...config,
    pages: {
      ...pages,
      home: {
        ...home,
        sections: validateHomeSections(sections),
      },
    },
  };
  delete normalized.homeSections;
  return normalized;
}

export function validateHomeSections(value: unknown): ThemePageSection[] {
  if (!Array.isArray(value)) {
    throw new BadRequestException('Home page sections must be an array');
  }
  if (value.length > MAX_HOME_SECTIONS) {
    throw new BadRequestException(
      `Home page cannot contain more than ${MAX_HOME_SECTIONS} sections`,
    );
  }

  const ids = new Set<string>();
  return value.map((item, index) => {
    if (!isPlainObject(item)) {
      throw new BadRequestException(`Home section at index ${index} must be an object`);
    }
    const type = readRequiredText(
      item.type,
      `pages.home.sections[${index}].type`,
    ) as ThemeSectionType;
    const definition = REGISTRY_BY_TYPE.get(type);
    if (!definition) {
      throw new BadRequestException(`Home section type "${type}" is not supported`);
    }

    const id = readRequiredText(item.id, `pages.home.sections[${index}].id`);
    if (!/^[a-zA-Z0-9_-]{2,80}$/.test(id)) {
      throw new BadRequestException(`Home section id "${id}" is invalid`);
    }
    if (ids.has(id)) {
      throw new BadRequestException(`Home section id "${id}" is duplicated`);
    }
    ids.add(id);

    const variant = readOptionalText(item.variant) ?? definition.defaultVariant;
    if (!definition.variants.includes(variant)) {
      throw new BadRequestException(
        `Variant "${variant}" is not supported for section type "${type}"`,
      );
    }

    const settings = isPlainObject(item.settings) ? item.settings : {};
    const source = validateSectionSource(type, item.source);

    return {
      id,
      type,
      variant,
      enabled: item.enabled !== false,
      locked: item.locked === true || definition.locked === true,
      settings: { ...cloneRecord(definition.defaultSettings), ...cloneRecord(settings) },
      ...(source ? { source } : {}),
      ...(isPlainObject(item.visibility) ? { visibility: cloneRecord(item.visibility) } : {}),
    };
  });
}

export function validateHomePageConfig(input: Record<string, unknown>): Record<string, unknown> {
  const sections = validateHomeSections(input.sections);
  return { sections };
}

function validateSectionSource(
  type: ThemeSectionType,
  source: unknown,
): Record<string, unknown> | undefined {
  const definition = getHomeSectionDefinition(type);
  const rawSource = source === undefined ? definition.defaultSource : source;
  if (rawSource === undefined) {
    return undefined;
  }
  if (!isPlainObject(rawSource)) {
    throw new BadRequestException(`Source for section type "${type}" must be an object`);
  }
  const sourceType = readOptionalText(rawSource.type) ?? 'manual';
  if (!definition.sourceTypes.includes(sourceType as ThemeSectionSourceType)) {
    return definition.defaultSource ? cloneRecord(definition.defaultSource) : undefined;
  }
  const normalized = cloneRecord(rawSource);
  normalized.type = sourceType;
  if (typeof normalized.limit === 'number') {
    normalized.limit = Math.max(1, Math.min(24, Math.floor(normalized.limit)));
  }
  return normalized;
}

function getHomeSectionDefinition(type: ThemeSectionType): ThemeHomeSectionDefinition {
  const definition = REGISTRY_BY_TYPE.get(type);
  if (!definition) {
    throw new BadRequestException(`Home section type "${type}" is not supported`);
  }
  return definition;
}

function readRequiredText(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > 80) {
    throw new BadRequestException(`${path} must be a non-empty string up to 80 chars`);
  }
  return value.trim();
}

function readOptionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function cloneRecord<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

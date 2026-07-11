import { BadRequestException, Injectable } from '@nestjs/common';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import type { RequestContextData } from '../common/utils/request-context.util';
import { SeoService } from '../seo/seo.service';
import { ShippingService } from '../shipping/shipping.service';
import { StoresRepository } from '../stores/stores.repository';
import { StoreReadinessRepository, type StoreReadinessFacts } from './store-readiness.repository';
import type {
  SetupSection,
  SetupStep,
  SetupStepStatus,
  StoreReadinessResponse,
} from './store-readiness.types';

const SECTION_WEIGHTS: Record<string, number> = {
  identity: 15,
  theme: 15,
  catalog: 25,
  checkout: 25,
  trust: 10,
  seo: 10,
};

const SKIPPABLE_STEPS = new Set([
  'identity.logo',
  'identity.description',
  'identity.working_hours',
  'theme.primary_color',
  'theme.hero_or_banner',
  'theme.preview_checked',
  'catalog.brands',
  'catalog.attributes',
  'catalog.featured_products',
  'catalog.product_images',
  'trust.published_pages',
  'seo.home_meta',
  'seo.og_image',
]);

@Injectable()
export class StoreReadinessService {
  constructor(
    private readonly readinessRepository: StoreReadinessRepository,
    private readonly storesRepository: StoresRepository,
    private readonly shippingService: ShippingService,
    private readonly seoService: SeoService,
  ) {}

  async getReadiness(currentUser: AuthUser): Promise<StoreReadinessResponse> {
    const [facts, progress] = await Promise.all([
      this.readinessRepository.getFacts(currentUser.storeId),
      this.readinessRepository.listProgress(currentUser.storeId),
    ]);

    const sections = this.buildSections(facts).map((section) => ({
      ...section,
      steps: section.steps.map((step) => {
        const skipped = progress.get(step.key)?.status === 'skipped';
        if (skipped && step.skippable && step.status !== 'completed') {
          return { ...step, status: 'skipped' as const };
        }
        return step;
      }),
    }));

    const normalizedSections = sections.map((section) => this.withSectionStats(section));
    const allSteps = normalizedSections.flatMap((section) => section.steps);
    const completedSteps = allSteps.filter((step) => this.isDone(step.status)).length;
    const blockingIssues = allSteps.filter((step) => step.status === 'blocking');
    const warnings = allSteps.filter((step) => step.status === 'warning');
    const score = Math.round(
      normalizedSections.reduce((sum, section) => {
        const done = section.steps.filter((step) => this.isDone(step.status)).length;
        const ratio = section.steps.length === 0 ? 1 : done / section.steps.length;
        return sum + ratio * section.weight;
      }, 0),
    );
    const canReceiveOrders = blockingIssues.length === 0;
    const nextBestAction =
      blockingIssues[0] ??
      allSteps.find((step) => step.status === 'missing') ??
      warnings[0] ??
      null;

    return {
      score,
      status: canReceiveOrders ? (score >= 100 ? 'ready' : 'needs_attention') : 'not_ready',
      canReceiveOrders,
      completedSteps,
      totalSteps: allSteps.length,
      blockingIssues,
      warnings,
      nextBestAction,
      sections: normalizedSections,
    };
  }

  async skipStep(
    currentUser: AuthUser,
    stepKey: string,
    reason?: string,
  ): Promise<StoreReadinessResponse> {
    if (!SKIPPABLE_STEPS.has(stepKey)) {
      throw new BadRequestException('هذه الخطوة لا يمكن تخطيها.');
    }
    await this.readinessRepository.skipStep(currentUser.storeId, stepKey, reason?.trim() || null);
    return this.getReadiness(currentUser);
  }

  async unskipStep(currentUser: AuthUser, stepKey: string): Promise<StoreReadinessResponse> {
    await this.readinessRepository.unskipStep(currentUser.storeId, stepKey);
    return this.getReadiness(currentUser);
  }

  async runQuickAction(
    currentUser: AuthUser,
    action: string,
    context: RequestContextData,
  ): Promise<StoreReadinessResponse> {
    if (action === 'enable_cod') {
      const enabled = await this.readinessRepository.enableCodPayment(currentUser.storeId);
      if (!enabled) {
        throw new BadRequestException('لا توجد طريقة دفع عند الاستلام مفعلة من المنصة.');
      }
      return this.getReadiness(currentUser);
    }

    if (action === 'quick_fulfillment') {
      const store = await this.storesRepository.findById(currentUser.storeId);
      await this.shippingService.quickSetup(
        currentUser,
        {
          city: store?.city || 'المدينة',
          enableLocalDelivery: true,
          localDeliveryFee: 0,
          enablePickup: true,
          pickupAddress: store?.address || store?.address_details || store?.city || 'موقع المتجر',
        },
        context,
      );
      return this.getReadiness(currentUser);
    }

    if (action === 'bootstrap_pages') {
      await this.seoService.bootstrapPages(currentUser, { overwrite: false });
      return this.getReadiness(currentUser);
    }

    if (action === 'seo_auto_fix') {
      await this.seoService.autoFix(currentUser, {
        scope: 'home',
        language: 'both',
        overwriteExisting: false,
        overwriteMode: 'missing_only',
      });
      return this.getReadiness(currentUser);
    }

    throw new BadRequestException('إجراء غير معروف.');
  }

  private buildSections(facts: StoreReadinessFacts): SetupSection[] {
    return [
      this.section('identity', 'هوية المتجر', [
        this.step(
          'identity.store_name',
          'اسم المتجر',
          'اسم واضح يظهر للعملاء.',
          facts.name,
          'blocking',
          false,
          'إكمال بيانات المتجر',
          'store',
        ),
        this.step(
          'identity.logo',
          'شعار المتجر',
          'إضافة شعار يزيد ثقة العميل.',
          facts.logo_url,
          'warning',
          true,
          'إضافة شعار',
          'store',
        ),
        this.step(
          'identity.description',
          'وصف مختصر',
          'وصف يشرح نشاط المتجر.',
          facts.description,
          'missing',
          true,
          'إضافة وصف',
          'store',
        ),
        this.step(
          'identity.phone',
          'رقم التواصل',
          'رقم هاتف أو واتساب للتواصل.',
          facts.phone,
          'warning',
          false,
          'إضافة رقم',
          'store',
        ),
        this.step(
          'identity.city',
          'مدينة المتجر',
          'تحديد المدينة يساعد في التوصيل.',
          facts.city,
          'warning',
          false,
          'تحديد المدينة',
          'store',
        ),
        this.step(
          'identity.currency',
          'العملة',
          'عملة البيع الأساسية مضبوطة.',
          facts.currency_code,
          'blocking',
          false,
          'ضبط العملة',
          'store',
        ),
        this.step(
          'identity.working_hours',
          'ساعات العمل',
          'تحديد أوقات استقبال الطلبات.',
          facts.working_hours_count > 0,
          'missing',
          true,
          'تحديد ساعات العمل',
          'store',
        ),
      ]),
      this.section('theme', 'المظهر والقالب', [
        this.step(
          'theme.template_selected',
          'اختيار قالب',
          'اختيار قالب مناسب للمتجر.',
          facts.theme_template_id,
          'blocking',
          false,
          'اختيار قالب',
          'themes',
        ),
        this.step(
          'theme.template_published',
          'نشر القالب',
          'نشر التصميم ليظهر للزوار.',
          facts.theme_count > 0,
          'blocking',
          false,
          'نشر القالب',
          'themes',
        ),
        this.step(
          'theme.primary_color',
          'ألوان الهوية',
          'تخصيص اللون الأساسي.',
          facts.theme_template_id,
          'missing',
          true,
          'تخصيص التصميم',
          'themes',
        ),
        this.step(
          'theme.hero_or_banner',
          'البانر الرئيسي',
          'تجهيز مساحة العرض الأولى.',
          facts.logo_url,
          'warning',
          true,
          'تخصيص الواجهة',
          'themes',
        ),
        this.step(
          'theme.preview_checked',
          'معاينة المتجر',
          'افتح المتجر وتأكد من شكله.',
          false,
          'missing',
          true,
          'معاينة المتجر',
          'themes',
        ),
      ]),
      this.section('catalog', 'تجهيز الكتالوج', [
        this.step(
          'catalog.categories',
          'التصنيفات',
          'تصنيف واحد على الأقل.',
          facts.category_count > 0,
          'blocking',
          false,
          'إضافة تصنيفات',
          'categories',
        ),
        this.step(
          'catalog.categories_visible',
          'تصنيفات ظاهرة',
          'التصنيفات مفعلة للعرض.',
          facts.visible_category_count > 0,
          'missing',
          false,
          'تفعيل التصنيفات',
          'categories',
        ),
        this.step(
          'catalog.brands',
          'العلامات التجارية',
          'أضف العلامات عند الحاجة.',
          facts.brand_count > 0,
          'missing',
          true,
          'إضافة علامات',
          'brands',
        ),
        this.step(
          'catalog.attributes',
          'الخصائص',
          'خصائص مثل اللون والمقاس.',
          facts.attribute_count > 0,
          'missing',
          true,
          'إضافة خصائص',
          'attributes',
        ),
        this.step(
          'catalog.products',
          'المنتجات',
          'منتج واحد على الأقل.',
          facts.product_count > 0,
          'blocking',
          false,
          'إضافة منتجات',
          'products',
        ),
        this.step(
          'catalog.products_visible',
          'منتجات ظاهرة',
          'منتجات منشورة وظاهرة للعملاء.',
          facts.visible_product_count > 0,
          'blocking',
          false,
          'نشر المنتجات',
          'products',
        ),
        this.step(
          'catalog.product_prices',
          'أسعار المنتجات',
          'كل منتج قابل للبيع له سعر.',
          facts.product_count > 0 && facts.priced_product_count >= facts.product_count,
          'blocking',
          false,
          'إكمال الأسعار',
          'products',
        ),
        this.step(
          'catalog.products_have_categories',
          'ربط المنتجات بالتصنيفات',
          'تنظيم المنتجات داخل تصنيفات.',
          facts.product_count > 0 && facts.products_with_category_count >= facts.product_count,
          'missing',
          false,
          'ربط التصنيفات',
          'products',
        ),
        this.step(
          'catalog.product_images',
          'صور المنتجات',
          'صور واضحة للمنتجات.',
          facts.product_count > 0 && facts.products_with_image_count >= facts.product_count,
          'warning',
          true,
          'إضافة صور',
          'products',
        ),
        this.step(
          'catalog.featured_products',
          'منتجات مميزة',
          'اختيار منتجات للواجهة.',
          facts.featured_product_count > 0,
          'missing',
          true,
          'تمييز منتجات',
          'products',
        ),
      ]),
      this.section('checkout', 'الدفع والتوصيل', [
        this.step(
          'checkout.payment_method',
          'طريقة دفع',
          'تفعيل طريقة دفع واحدة على الأقل.',
          facts.enabled_payment_count > 0,
          'blocking',
          false,
          'تفعيل الدفع عند الاستلام',
          'payments',
          'enable_cod',
        ),
        this.step(
          'checkout.payment_configured',
          'بيانات الدفع مكتملة',
          'بيانات الحوالات أو الحسابات مكتملة.',
          facts.incomplete_payment_count === 0,
          'blocking',
          false,
          'إكمال بيانات الدفع',
          'payments',
        ),
        this.step(
          'checkout.shipping_method',
          'طريقة توصيل أو استلام',
          'تفعيل التوصيل أو الاستلام من المتجر.',
          facts.active_shipping_method_count > 0,
          'blocking',
          false,
          'تفعيل التوصيل والاستلام',
          'shipping',
          'quick_fulfillment',
        ),
      ]),
      this.section('trust', 'صفحات الثقة والسياسات', [
        this.step(
          'trust.pages',
          'الصفحات الأساسية',
          'إنشاء صفحات من نحن والتواصل والسياسات.',
          facts.trust_page_count >= 4,
          'missing',
          false,
          'إنشاء الصفحات',
          'storePages',
          'bootstrap_pages',
        ),
        this.step(
          'trust.published_pages',
          'نشر صفحات الثقة',
          'الصفحات جاهزة للزوار.',
          facts.published_trust_page_count >= 4,
          'warning',
          true,
          'مراجعة الصفحات',
          'storePages',
        ),
      ]),
      this.section('seo', 'SEO والاختبار النهائي', [
        this.step(
          'seo.home_meta',
          'عنوان ووصف البحث',
          'بيانات ظهور الصفحة الرئيسية في نتائج البحث.',
          facts.home_seo_ready,
          'warning',
          true,
          'إصلاح SEO تلقائياً',
          'seo',
          'seo_auto_fix',
        ),
        this.step(
          'seo.og_image',
          'صورة المشاركة',
          'صورة تظهر عند مشاركة رابط المتجر.',
          facts.default_og_image_ready,
          'warning',
          true,
          'إضافة صورة مشاركة',
          'seo',
        ),
        this.step(
          'seo.final_checkout_test',
          'اختبار الطلب',
          'تأكد من إمكانية تنفيذ طلب فعلي.',
          facts.enabled_payment_count > 0 &&
            facts.active_shipping_method_count > 0 &&
            facts.visible_product_count > 0,
          'blocking',
          false,
          'فتح الطلبات',
          'orders',
        ),
      ]),
    ];
  }

  private section(key: string, title: string, steps: SetupStep[]): SetupSection {
    return {
      key,
      title,
      weight: SECTION_WEIGHTS[key] ?? 0,
      completedSteps: 0,
      totalSteps: steps.length,
      status: 'missing',
      steps,
    };
  }

  private step(
    key: string,
    title: string,
    description: string,
    condition: unknown,
    missingStatus: Exclude<SetupStepStatus, 'completed' | 'skipped'>,
    skippable: boolean,
    actionLabel: string,
    actionTab: string,
    quickAction: string | null = null,
  ): SetupStep {
    return {
      key,
      title,
      description,
      status: condition ? 'completed' : missingStatus,
      required: missingStatus === 'blocking',
      skippable,
      actionLabel,
      actionTab,
      quickAction,
    };
  }

  private withSectionStats(section: SetupSection): SetupSection {
    const completedSteps = section.steps.filter((step) => this.isDone(step.status)).length;
    const status = this.sectionStatus(section.steps);
    return { ...section, completedSteps, totalSteps: section.steps.length, status };
  }

  private sectionStatus(steps: SetupStep[]): SetupStepStatus {
    if (steps.some((step) => step.status === 'blocking')) return 'blocking';
    if (steps.some((step) => step.status === 'missing')) return 'missing';
    if (steps.some((step) => step.status === 'warning')) return 'warning';
    return 'completed';
  }

  private isDone(status: SetupStepStatus): boolean {
    return status === 'completed' || status === 'skipped';
  }
}

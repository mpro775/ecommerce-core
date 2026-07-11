import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { envValidationSchema } from './config/env.validation';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { AuditModule } from './audit/audit.module';
import { AttributesModule } from './attributes/attributes.module';
import { AuthModule } from './auth/auth.module';
import { BrandsModule } from './brands/brands.module';
import { CategoriesModule } from './categories/categories.module';
import { DatabaseModule } from './database/database.module';
import { DomainsModule } from './domains/domains.module';
import { EmailModule } from './email/email.module';
import { HealthModule } from './health/health.module';
import { InventoryModule } from './inventory/inventory.module';
import { MediaModule } from './media/media.module';
import { MessagingModule } from './messaging/messaging.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { PromotionsModule } from './promotions/promotions.module';
import { ProductsModule } from './products/products.module';
import { SaasModule } from './saas/saas.module';
import { ShippingModule } from './shipping/shipping.module';
import { StoresModule } from './stores/stores.module';
import { StorefrontModule } from './storefront/storefront.module';
import { ThemesModule } from './themes/themes.module';
import { UsersModule } from './users/users.module';
import { ObservabilityModule } from './observability/observability.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { AdvancedOffersModule } from './advanced-offers/advanced-offers.module';
import { CustomersModule } from './customers/customers.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { WarehousesModule } from './warehouses/warehouses.module';
import { FiltersModule } from './filters/filters.module';
import { LoyaltyModule } from './loyalty/loyalty.module';
import { AffiliatesModule } from './affiliates/affiliates.module';
import { SupportModule } from './support/support.module';
import { PlatformModule } from './platform/platform.module';
import { PlatformCoreModule } from './platform-admin/core/platform-core.module';
import { PlatformBillingModule } from './platform-admin/billing/platform-billing.module';
import { PlatformOperationsModule } from './platform-admin/operations/platform-operations.module';
import { PlatformThemeTemplatesModule } from './platform-admin/theme-templates/platform-theme-templates.module';
import { PaymentMethodsModule } from './payment-methods/payment-methods.module';
import { SeoModule } from './seo/seo.module';
import { StoreReadinessModule } from './store-readiness/store-readiness.module';
import { QaModule } from './qa/qa.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
      validationSchema: envValidationSchema,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),
    DatabaseModule,
    EmailModule,
    ObservabilityModule,
    AuditModule,
    MessagingModule,
    NotificationsModule,
    HealthModule,
    AuthModule,
    StoresModule,
    UsersModule,
    CategoriesModule,
    BrandsModule,
    AttributesModule,
    FiltersModule,
    ProductsModule,
    SaasModule,
    MediaModule,
    ShippingModule,
    PromotionsModule,
    ThemesModule,
    DomainsModule,
    WebhooksModule,
    AdvancedOffersModule,
    InventoryModule,
    OrdersModule,
    PaymentsModule,
    StorefrontModule,
    CustomersModule,
    AnalyticsModule,
    WarehousesModule,
    LoyaltyModule,
    AffiliatesModule,
    SupportModule,
    PlatformModule,
    PlatformCoreModule,
    PlatformBillingModule,
    PlatformOperationsModule,
    PlatformThemeTemplatesModule,
    PaymentMethodsModule,
    SeoModule,
    StoreReadinessModule,
    QaModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}

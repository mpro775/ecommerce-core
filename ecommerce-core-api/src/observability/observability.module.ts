import { Module, Global } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { SaasModule } from '../saas/saas.module';
import { ApiUsageInterceptor } from '../saas/interceptors/api-usage.interceptor';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { MetricsInterceptor } from './metrics.interceptor';
import { SentryModule } from './sentry.module';

@Global()
@Module({
  imports: [SentryModule, SaasModule],
  controllers: [MetricsController],
  providers: [
    MetricsService,
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ApiUsageInterceptor,
    },
  ],
  exports: [MetricsService],
})
export class ObservabilityModule {}

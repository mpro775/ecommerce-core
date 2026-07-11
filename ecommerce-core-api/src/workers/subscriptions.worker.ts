import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SaasService } from '../saas/saas.service';

const logger = new Logger('SubscriptionsWorker');

export async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const configService = app.get(ConfigService);
  const saasService = app.get(SaasService);

  const intervalMs = Math.max(
    60_000,
    configService.get<number>('SUBSCRIPTION_WORKER_INTERVAL_MS', 300_000),
  );
  const batchSize = Math.max(1, configService.get<number>('SUBSCRIPTION_WORKER_BATCH_SIZE', 100));

  const runCycle = async () => {
    const startedAt = Date.now();
    try {
      const expiredTrials = await saasService.processExpiredTrials(batchSize);
      logger.log(
        `Cycle completed in ${Date.now() - startedAt}ms. expiredTrials=${expiredTrials.processed}`,
      );
    } catch (error) {
      logger.error(error instanceof Error ? error.message : 'Failed to process subscription cycle');
    }
  };

  await runCycle();
  const timer = setInterval(() => {
    void runCycle();
  }, intervalMs);

  const shutdown = async () => {
    clearInterval(timer);
    await app.close();
  };

  process.on('SIGINT', () => {
    void shutdown();
  });

  process.on('SIGTERM', () => {
    void shutdown();
  });

  logger.log(`Subscriptions worker is running. intervalMs=${intervalMs} batchSize=${batchSize}`);
}

if (require.main === module) {
  bootstrap().catch((error: unknown) => {
    logger.error(error instanceof Error ? error.message : 'Failed to start subscriptions worker');
    process.exit(1);
  });
}

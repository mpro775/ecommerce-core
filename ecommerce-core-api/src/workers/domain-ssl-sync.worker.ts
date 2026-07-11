import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DomainsService } from '../domains/domains.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const logger = new Logger('DomainSslSyncWorker');
  const configService = app.get(ConfigService);
  const domainsService = app.get(DomainsService);
  const intervalMs = configService.get<number>('DOMAIN_SSL_SYNC_INTERVAL_MS', 300_000);
  const batchSize = configService.get<number>('DOMAIN_SSL_SYNC_BATCH_SIZE', 100);

  async function runOnce(): Promise<void> {
    try {
      const result = await domainsService.syncPendingSslDomains(batchSize);
      if (result.checked > 0) {
        logger.log(
          `SSL sync checked=${result.checked} updated=${result.updated} failed=${result.failed}`,
        );
      }
    } catch (error) {
      logger.error(error instanceof Error ? error.message : 'Domain SSL sync failed');
    }
  }

  await runOnce();
  setInterval(() => {
    runOnce().catch((error) => {
      logger.error(error instanceof Error ? error.message : 'Domain SSL sync failed');
    });
  }, intervalMs);
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});

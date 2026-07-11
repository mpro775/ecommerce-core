import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { PlatformModule } from '../platform/platform.module';
import { QaAttachmentsService } from './qa-attachments.service';
import { QaController } from './qa.controller';
import { QaDashboardService } from './qa-dashboard.service';
import { QaImportService } from './qa-import.service';
import { QaRepository } from './qa.repository';
import { QaReportsService } from './qa-reports.service';
import { QaService } from './qa.service';
import { QaSummaryService } from './qa-summary.service';

@Module({
  imports: [PlatformModule, MediaModule],
  controllers: [QaController],
  providers: [
    QaRepository,
    QaImportService,
    QaSummaryService,
    QaDashboardService,
    QaAttachmentsService,
    QaReportsService,
    QaService,
  ],
  exports: [QaImportService, QaService],
})
export class QaModule {}

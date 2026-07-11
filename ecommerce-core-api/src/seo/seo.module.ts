import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { SeoController } from './seo.controller';
import { SeoRepository } from './seo.repository';
import { SeoService } from './seo.service';

@Module({
  imports: [DatabaseModule],
  controllers: [SeoController],
  providers: [SeoRepository, SeoService],
  exports: [SeoRepository, SeoService],
})
export class SeoModule {}

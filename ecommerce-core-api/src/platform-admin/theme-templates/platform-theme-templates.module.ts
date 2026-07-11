import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { MediaModule } from '../../media/media.module';
import { PlatformModule } from '../../platform/platform.module';
import { PlatformThemeTemplatesController } from './platform-theme-templates.controller';
import { PlatformThemeTemplatesRepository } from './platform-theme-templates.repository';
import { PlatformThemeTemplatesService } from './platform-theme-templates.service';

@Module({
  imports: [DatabaseModule, PlatformModule, MediaModule],
  controllers: [PlatformThemeTemplatesController],
  providers: [PlatformThemeTemplatesRepository, PlatformThemeTemplatesService],
  exports: [PlatformThemeTemplatesRepository],
})
export class PlatformThemeTemplatesModule {}

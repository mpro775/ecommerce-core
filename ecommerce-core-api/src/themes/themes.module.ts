import { Module } from '@nestjs/common';
import { SecurityModule } from '../security/security.module';
import { ThemesController } from './themes.controller';
import { ThemesRepository } from './themes.repository';
import { ThemesService } from './themes.service';

@Module({
  imports: [SecurityModule],
  controllers: [ThemesController],
  providers: [ThemesService, ThemesRepository],
  exports: [ThemesService, ThemesRepository],
})
export class ThemesModule {}

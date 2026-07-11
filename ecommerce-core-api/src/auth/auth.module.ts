import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { SaasModule } from '../saas/saas.module';
import { SecurityModule } from '../security/security.module';

@Module({
  imports: [SecurityModule, SaasModule],
  controllers: [AuthController],
  providers: [AuthService, AuthRepository],
  exports: [AuthRepository, AuthService],
})
export class AuthModule {}

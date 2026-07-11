import { Injectable } from '@nestjs/common';
import { SaasService } from '../../../saas/saas.service';

@Injectable()
export class PlatformAuditService {
  constructor(private readonly saasService: SaasService) {}

  listPlatformAuditLogs(
    ...args: Parameters<SaasService['listPlatformAuditLogs']>
  ): ReturnType<SaasService['listPlatformAuditLogs']> {
    return this.saasService.listPlatformAuditLogs(...args);
  }
}

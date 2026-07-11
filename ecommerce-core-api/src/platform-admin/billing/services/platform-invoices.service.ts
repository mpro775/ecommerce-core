import { Injectable } from '@nestjs/common';
import { SaasService } from '../../../saas/saas.service';

@Injectable()
export class PlatformInvoicesService {
  constructor(private readonly saasService: SaasService) {}

  settleInvoice(
    ...args: Parameters<SaasService['settleInvoice']>
  ): ReturnType<SaasService['settleInvoice']> {
    return this.saasService.settleInvoice(...args);
  }
}

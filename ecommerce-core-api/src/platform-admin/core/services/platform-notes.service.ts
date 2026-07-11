import { Injectable } from '@nestjs/common';
import { SaasService } from '../../../saas/saas.service';

@Injectable()
export class PlatformNotesService {
  constructor(private readonly saasService: SaasService) {}

  listPlatformStoreNotes(
    ...args: Parameters<SaasService['listPlatformStoreNotes']>
  ): ReturnType<SaasService['listPlatformStoreNotes']> {
    return this.saasService.listPlatformStoreNotes(...args);
  }

  createPlatformStoreNote(
    ...args: Parameters<SaasService['createPlatformStoreNote']>
  ): ReturnType<SaasService['createPlatformStoreNote']> {
    return this.saasService.createPlatformStoreNote(...args);
  }
}

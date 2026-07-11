import { Controller, Get, Req } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { StorefrontService, type PublicStoreResolveResponse } from './storefront.service';

@ApiTags('public')
@Controller('public/store')
@Public()
export class PublicStoreController {
  constructor(private readonly storefrontService: StorefrontService) {}

  @Get('resolve')
  @ApiOkResponse({ description: 'Resolve store context from request host' })
  async resolve(@Req() request: Request): Promise<PublicStoreResolveResponse> {
    return this.storefrontService.resolvePublicStore(request);
  }
}

import { Body, Controller, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { ProviderWebhookDto } from './dto/provider-webhook.dto';
import { SaasService } from './saas.service';

@ApiTags('billing')
@Controller('billing')
export class BillingWebhookController {
  constructor(
    private readonly saasService: SaasService,
    private readonly configService: ConfigService,
  ) {}

  @Post('provider-webhook')
  @ApiOkResponse({ description: 'Handle provider webhook for subscription billing lifecycle' })
  async providerWebhook(
    @Body() body: ProviderWebhookDto,
    @Headers('x-billing-webhook-secret') secret: string | undefined,
  ) {
    const expected = this.configService.get<string>('BILLING_WEBHOOK_SECRET', '').trim();
    if (!expected || !secret || secret.trim() !== expected) {
      throw new UnauthorizedException('Invalid billing webhook secret');
    }

    return this.saasService.handleProviderWebhook(body);
  }
}

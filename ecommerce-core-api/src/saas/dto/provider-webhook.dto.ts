import { IsIn, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

const WEBHOOK_EVENT_TYPES = [
  'invoice.paid',
  'invoice.failed',
  'subscription.updated',
  'subscription.canceled',
  'payment.refunded',
] as const;

export class ProviderWebhookDto {
  @IsIn(WEBHOOK_EVENT_TYPES)
  eventType!: (typeof WEBHOOK_EVENT_TYPES)[number];

  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string;

  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @IsString()
  externalInvoiceId?: string;

  @IsOptional()
  @IsString()
  externalSubscriptionId?: string;

  @IsOptional()
  @IsString()
  @IsIn(['paid', 'failed', 'canceled', 'active', 'trialing', 'past_due'])
  status?: string;

  @IsOptional()
  @Matches(/^[A-Z]{3}$/)
  currencyCode?: string;

  @IsOptional()
  @IsString()
  amount?: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}

import { IsObject, IsOptional, IsUUID } from 'class-validator';

export class TriggerPlatformAutomationRuleDto {
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

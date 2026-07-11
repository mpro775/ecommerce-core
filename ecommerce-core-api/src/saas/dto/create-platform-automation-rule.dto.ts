import { IsBoolean, IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePlatformAutomationRuleDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsIn(['manual', 'schedule', 'event'])
  triggerType!: 'manual' | 'schedule' | 'event';

  @IsObject()
  triggerConfig!: Record<string, unknown>;

  @IsString()
  @MaxLength(80)
  actionType!: string;

  @IsObject()
  actionConfig!: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

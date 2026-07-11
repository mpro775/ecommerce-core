import { IsBoolean } from 'class-validator';

export class UpdatePlatformAutomationRuleStatusDto {
  @IsBoolean()
  isActive!: boolean;
}

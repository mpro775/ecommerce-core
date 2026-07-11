import { IsBoolean, IsIn, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateAccessibilitySettingsDto {
  @IsOptional()
  @IsIn(['normal', 'high'])
  contrastMode?: 'normal' | 'high';

  @IsOptional()
  @IsBoolean()
  reducedMotion?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1.5)
  fontScale?: number;

  @IsOptional()
  @IsBoolean()
  underlineLinks?: boolean;

  @IsOptional()
  @IsBoolean()
  strongFocusRing?: boolean;

  @IsOptional()
  @IsBoolean()
  accessibleAnimations?: boolean;
}

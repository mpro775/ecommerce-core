import { IsString, MaxLength, MinLength } from 'class-validator';

export class ApplyThemeDesignPresetDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  presetKey!: string;
}

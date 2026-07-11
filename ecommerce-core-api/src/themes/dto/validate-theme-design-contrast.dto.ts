import { IsObject } from 'class-validator';

export class ValidateThemeDesignContrastDto {
  @IsObject()
  colors!: Record<string, unknown>;
}

import { IsObject } from 'class-validator';

export class UpdateThemeDesignDto {
  @IsObject()
  design!: Record<string, unknown>;
}

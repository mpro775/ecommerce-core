import { IsObject } from 'class-validator';

export class UpdateThemeDraftDto {
  @IsObject()
  config!: Record<string, unknown>;
}

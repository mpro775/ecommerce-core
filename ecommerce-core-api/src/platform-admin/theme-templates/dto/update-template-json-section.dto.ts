import { IsObject } from 'class-validator';

export class UpdateTemplateJsonSectionDto {
  @IsObject()
  value!: Record<string, unknown>;
}

import { IsArray } from 'class-validator';

export class UpdateHomePageDto {
  @IsArray()
  sections!: unknown[];
}

import { IsString, MaxLength, MinLength } from 'class-validator';

export class ApplyThemeTemplateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  templateKey!: string;
}

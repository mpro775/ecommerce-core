import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ThemeQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(180)
  store?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  previewToken?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  templatePreview?: string;
}

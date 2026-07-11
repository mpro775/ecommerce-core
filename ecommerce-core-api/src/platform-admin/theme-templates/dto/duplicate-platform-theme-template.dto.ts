import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class DuplicatePlatformThemeTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  templateKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  nameAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  nameEn?: string;
}

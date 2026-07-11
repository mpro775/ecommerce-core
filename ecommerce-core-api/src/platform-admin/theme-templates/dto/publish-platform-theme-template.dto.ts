import { IsOptional, IsString, MaxLength } from 'class-validator';

export class PublishPlatformThemeTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  changelogTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  changelogDescription?: string;
}

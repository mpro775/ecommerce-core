import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateTemplateMediaDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  thumbnailUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  previewImageUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  previewImages?: string[];
}

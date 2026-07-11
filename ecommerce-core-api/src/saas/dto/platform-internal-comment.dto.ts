import { IsOptional, IsString, MaxLength } from 'class-validator';

export class PlatformInternalCommentDto {
  @IsString()
  @MaxLength(4000)
  body!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reason?: string;
}

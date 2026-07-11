import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class CreateThemePreviewTokenDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(240)
  expiresInMinutes?: number;
}

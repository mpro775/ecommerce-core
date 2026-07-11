import { IsString, MinLength } from 'class-validator';

export class PlatformRefreshTokenDto {
  @IsString()
  @MinLength(16)
  refreshToken!: string;
}

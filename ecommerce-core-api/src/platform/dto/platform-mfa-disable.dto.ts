import { IsOptional, IsString, Length, MaxLength, MinLength } from 'class-validator';

export class PlatformMfaDisableDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsString()
  @Length(6, 6)
  code?: string;

  @IsOptional()
  @IsString()
  backupCode?: string;
}

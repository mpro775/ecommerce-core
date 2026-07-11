import { IsOptional, IsString, Length, MaxLength, MinLength } from 'class-validator';

export class PlatformStepUpDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsString()
  @Length(6, 6)
  otpCode?: string;
}

import { IsEmail, IsOptional, IsString, Length, MaxLength, MinLength } from 'class-validator';

export class PlatformLoginDto {
  @IsEmail()
  @MaxLength(180)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsString()
  @Length(6, 6)
  otpCode?: string;
}

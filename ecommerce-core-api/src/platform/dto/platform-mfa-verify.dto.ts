import { IsString, Length } from 'class-validator';

export class PlatformMfaVerifyDto {
  @IsString()
  secret!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}

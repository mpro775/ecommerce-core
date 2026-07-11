import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RetryStorePurgeDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

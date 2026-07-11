import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateStoreSuspensionDto {
  @IsBoolean()
  isSuspended!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ConfirmStoreDeletionDto {
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  confirmationText!: string;

  @IsOptional()
  @IsBoolean()
  releaseEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  purgeOperationalData?: boolean;
}

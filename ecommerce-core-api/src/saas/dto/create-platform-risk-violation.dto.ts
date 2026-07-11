import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePlatformRiskViolationDto {
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsString()
  @MaxLength(80)
  category!: string;

  @IsIn(['low', 'medium', 'high', 'critical'])
  severity!: 'low' | 'medium' | 'high' | 'critical';

  @IsInt()
  @Min(0)
  @Max(100)
  score!: number;

  @IsString()
  @MaxLength(300)
  summary!: string;

  @IsOptional()
  @IsObject()
  details?: Record<string, unknown>;

  @IsOptional()
  @IsUUID()
  ownerAdminId?: string;
}

import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CreatePlatformSupportCaseDto {
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsString()
  @MaxLength(160)
  subject!: string;

  @IsString()
  @MaxLength(3000)
  description!: string;

  @IsIn(['low', 'medium', 'high', 'critical'])
  priority!: 'low' | 'medium' | 'high' | 'critical';

  @IsOptional()
  @IsString()
  @MaxLength(60)
  queue?: string;

  @IsOptional()
  @IsUUID()
  assigneeAdminId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  impactScore?: number;
}

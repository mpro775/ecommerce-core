import { IsArray, IsIn, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreatePlatformComplianceTaskDto {
  @IsOptional()
  @IsUUID()
  violationId?: string;

  @IsString()
  @MaxLength(120)
  policyKey!: string;

  @IsString()
  @MaxLength(180)
  title!: string;

  @IsIn(['pending', 'in_progress', 'done', 'skipped'])
  status!: 'pending' | 'in_progress' | 'done' | 'skipped';

  @IsOptional()
  @IsUUID()
  assigneeAdminId?: string;

  @IsOptional()
  @IsArray()
  checklist?: Array<Record<string, unknown>>;

  @IsOptional()
  @IsObject()
  evidence?: Record<string, unknown>;
}

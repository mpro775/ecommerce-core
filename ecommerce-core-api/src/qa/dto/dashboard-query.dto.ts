import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { QA_RUN_STATUSES, type QaRunStatus } from '../enums/qa-run-status.enum';

export class QaDashboardQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  until?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  scenarioId?: string;

  @IsOptional()
  @IsUUID()
  testerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  environment?: string;

  @IsOptional()
  @IsIn(QA_RUN_STATUSES)
  status?: QaRunStatus;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  round?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  buildVersion?: string;
}

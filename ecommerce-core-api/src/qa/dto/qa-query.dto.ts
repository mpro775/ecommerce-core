import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { QA_RUN_STATUSES, type QaRunStatus } from '../enums/qa-run-status.enum';

export class QaListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  sort?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}

export class QaRunsQueryDto extends QaListQueryDto {
  @IsOptional()
  @IsUUID()
  scenarioId?: string;

  @IsOptional()
  @IsIn(QA_RUN_STATUSES)
  status?: QaRunStatus;
}

export class QaIssuesQueryDto extends QaListQueryDto {
  @IsOptional()
  @IsUUID()
  runId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  scenarioId?: string;

  @IsOptional()
  @IsUUID()
  phaseId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  category?: string;

  @IsOptional()
  @IsIn(['low', 'medium', 'high', 'critical'])
  severity?: string;

  @IsOptional()
  @IsIn(['open', 'triaged', 'fixed', 'wont_fix', 'verified'])
  status?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  isBlocking?: string;
}

import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { QA_ISSUE_CATEGORIES, type QaIssueCategory } from '../enums/qa-issue-category.enum';
import { QA_ISSUE_SEVERITIES, type QaIssueSeverity } from '../enums/qa-issue-severity.enum';

export class CreateQaIssueDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  stepsToReproduce?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  expectedResult?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  actualResult?: string;

  @IsIn(QA_ISSUE_SEVERITIES)
  severity!: QaIssueSeverity;

  @IsIn(QA_ISSUE_CATEGORIES)
  category!: QaIssueCategory;

  @IsOptional()
  @IsBoolean()
  isBlocking?: boolean;

  @IsOptional()
  @IsUUID()
  phaseId?: string;

  @IsOptional()
  @IsUUID()
  checkId?: string;

  @IsOptional()
  @IsUUID()
  questionId?: string;
}

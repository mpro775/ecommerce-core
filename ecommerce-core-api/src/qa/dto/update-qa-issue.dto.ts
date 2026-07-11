import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { QA_ISSUE_CATEGORIES, type QaIssueCategory } from '../enums/qa-issue-category.enum';
import { QA_ISSUE_SEVERITIES, type QaIssueSeverity } from '../enums/qa-issue-severity.enum';

export class UpdateQaIssueDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;

  @IsOptional()
  @IsIn(QA_ISSUE_SEVERITIES)
  severity?: QaIssueSeverity;

  @IsOptional()
  @IsIn(QA_ISSUE_CATEGORIES)
  category?: QaIssueCategory;

  @IsOptional()
  @IsIn(['open', 'triaged', 'fixed', 'wont_fix', 'verified'])
  status?: 'open' | 'triaged' | 'fixed' | 'wont_fix' | 'verified';

  @IsOptional()
  @IsBoolean()
  isBlocking?: boolean;
}

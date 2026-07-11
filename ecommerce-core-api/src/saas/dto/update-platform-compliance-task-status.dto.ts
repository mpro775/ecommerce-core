import { IsIn } from 'class-validator';

export class UpdatePlatformComplianceTaskStatusDto {
  @IsIn(['pending', 'in_progress', 'done', 'skipped'])
  status!: 'pending' | 'in_progress' | 'done' | 'skipped';
}

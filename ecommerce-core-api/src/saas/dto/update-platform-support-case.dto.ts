import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpdatePlatformSupportCaseDto {
  @IsOptional()
  @IsIn(['open', 'in_progress', 'escalated', 'resolved', 'closed'])
  status?: 'open' | 'in_progress' | 'escalated' | 'resolved' | 'closed';

  @IsOptional()
  @IsUUID()
  assigneeAdminId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  queue?: string;
}

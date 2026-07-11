import { IsIn } from 'class-validator';

export class UpdatePlatformRiskViolationStatusDto {
  @IsIn(['open', 'investigating', 'mitigated', 'accepted', 'resolved'])
  status!: 'open' | 'investigating' | 'mitigated' | 'accepted' | 'resolved';
}

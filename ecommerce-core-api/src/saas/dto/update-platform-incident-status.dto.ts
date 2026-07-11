import { IsIn } from 'class-validator';

export class UpdatePlatformIncidentStatusDto {
  @IsIn(['open', 'investigating', 'mitigated', 'resolved'])
  status!: 'open' | 'investigating' | 'mitigated' | 'resolved';
}

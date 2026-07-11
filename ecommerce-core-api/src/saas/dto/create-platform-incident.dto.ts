import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreatePlatformIncidentDto {
  @IsString()
  @MaxLength(40)
  type!: string;

  @IsIn(['low', 'medium', 'high', 'critical'])
  severity!: 'low' | 'medium' | 'high' | 'critical';

  @IsString()
  @MaxLength(80)
  service!: string;

  @IsString()
  @MaxLength(150)
  title!: string;

  @IsString()
  @MaxLength(2000)
  summary!: string;

  @IsOptional()
  @IsIn(['open', 'investigating', 'mitigated', 'resolved'])
  status?: 'open' | 'investigating' | 'mitigated' | 'resolved';

  @IsOptional()
  @IsUUID('4')
  relatedStoreId?: string;
}

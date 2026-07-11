import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { LIMIT_RESET_PERIODS, SAAS_METRICS } from '../constants/saas-metrics.constants';

export class UpsertPlanLimitDto {
  @IsIn(SAAS_METRICS)
  metricKey!: (typeof SAAS_METRICS)[number];

  @IsOptional()
  @IsInt()
  @Min(1)
  metricLimit?: number | null;

  @IsString()
  @MaxLength(16)
  @IsIn(LIMIT_RESET_PERIODS)
  resetPeriod!: (typeof LIMIT_RESET_PERIODS)[number];
}

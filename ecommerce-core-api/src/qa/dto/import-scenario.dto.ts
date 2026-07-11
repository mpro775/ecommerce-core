import { IsBoolean, IsOptional } from 'class-validator';

export class ImportScenarioDto {
  @IsOptional()
  scenario?: unknown;

  @IsOptional()
  @IsBoolean()
  publish?: boolean;
}

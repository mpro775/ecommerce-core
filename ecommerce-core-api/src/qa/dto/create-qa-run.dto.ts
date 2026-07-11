import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateQaRunDto {
  @IsUUID()
  scenarioId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  environment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  deviceType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  browser?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  os?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  screenSize?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  buildVersion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  testRound?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}

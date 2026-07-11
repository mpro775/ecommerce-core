import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CompleteQaRunDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}

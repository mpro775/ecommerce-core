import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { UpdateQaAnswerDto } from './update-qa-answer.dto';

export class BulkUpdateQaAnswersDto {
  @IsOptional()
  @IsUUID()
  currentPhaseId?: string;

  @IsOptional()
  @IsString()
  currentPhaseKey?: string;

  @IsOptional()
  @IsUUID()
  currentCheckId?: string;

  @IsOptional()
  @IsString()
  currentCheckKey?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateQaAnswerDto)
  answers!: UpdateQaAnswerDto[];
}

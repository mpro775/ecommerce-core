import {
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { QA_ANSWER_STATUSES, type QaAnswerStatus } from '../enums/qa-answer-status.enum';

export class UpdateQaAnswerDto {
  @IsUUID()
  phaseId!: string;

  @IsOptional()
  @IsUUID()
  checkId?: string;

  @IsOptional()
  @IsUUID()
  questionId?: string;

  @IsOptional()
  @IsIn(QA_ANSWER_STATUSES)
  status?: QaAnswerStatus;

  @IsOptional()
  @IsObject()
  value?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  note?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  rating?: number;
}

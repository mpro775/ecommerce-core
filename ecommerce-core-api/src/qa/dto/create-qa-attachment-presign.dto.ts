import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { MAX_UPLOAD_BYTES } from '../../media/media.constants';
import { QA_ATTACHMENT_TARGETS, type QaAttachmentTarget } from '../enums/qa-attachment-target.enum';

export class CreateQaAttachmentPresignDto {
  @IsIn(QA_ATTACHMENT_TARGETS)
  targetType!: QaAttachmentTarget;

  @IsString()
  @MaxLength(255)
  fileName!: string;

  @IsString()
  @MaxLength(120)
  mimeType!: string;

  @IsInt()
  @Min(1)
  @Max(MAX_UPLOAD_BYTES)
  sizeBytes!: number;

  @IsOptional()
  @IsUUID()
  issueId?: string;

  @IsOptional()
  @IsUUID()
  phaseId?: string;

  @IsOptional()
  @IsUUID()
  checkId?: string;

  @IsOptional()
  @IsUUID()
  questionId?: string;
}

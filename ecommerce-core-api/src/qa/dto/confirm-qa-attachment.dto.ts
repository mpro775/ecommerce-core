import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CreateQaAttachmentPresignDto } from './create-qa-attachment-presign.dto';

export class ConfirmQaAttachmentDto extends CreateQaAttachmentPresignDto {
  @IsString()
  @MaxLength(600)
  objectKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  etag?: string;
}

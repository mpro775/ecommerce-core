import { IsString, MaxLength } from 'class-validator';

export class PlatformInvoiceNoteDto {
  @IsString()
  @MaxLength(4000)
  body!: string;
}

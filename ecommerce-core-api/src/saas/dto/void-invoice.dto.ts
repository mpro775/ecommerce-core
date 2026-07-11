import { IsString, MaxLength } from 'class-validator';

export class VoidInvoiceDto {
  @IsString()
  @MaxLength(1000)
  reason!: string;
}

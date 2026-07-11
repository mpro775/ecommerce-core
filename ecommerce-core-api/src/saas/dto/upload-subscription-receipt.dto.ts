import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class UploadSubscriptionReceiptDto {
  @IsUUID()
  invoiceId!: string;

  @IsOptional()
  @IsUUID()
  paymentMethodId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  paymentMethodCode?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  paymentMethodName?: string | null;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currencyCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  transactionReference?: string | null;

  @IsOptional()
  @IsDateString()
  paidAt?: string | null;

  @IsOptional()
  @IsUUID()
  receiptMediaId?: string | null;

  @ValidateIf((body: UploadSubscriptionReceiptDto) => !body.receiptMediaId)
  @IsString()
  @MaxLength(2048)
  receiptUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  receiptFileName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  receiptMimeType?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(1)
  receiptSizeBytes?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  merchantNote?: string | null;
}

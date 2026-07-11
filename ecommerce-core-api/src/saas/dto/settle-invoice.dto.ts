import { IsIn, IsNumberString, IsOptional, IsString, Matches } from 'class-validator';

export class SettleInvoiceDto {
  @IsIn(['succeeded', 'failed'])
  paymentStatus!: 'succeeded' | 'failed';

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  externalTransactionId?: string;

  @IsOptional()
  @IsString()
  failureReason?: string;

  @IsOptional()
  @Matches(/^[A-Z]{3}$/)
  currencyCode?: string;

  @IsOptional()
  @IsNumberString()
  amount?: string;
}

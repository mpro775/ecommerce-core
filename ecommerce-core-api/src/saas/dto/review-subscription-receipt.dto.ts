import { IsIn, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export class ReviewSubscriptionReceiptDto {
  @IsIn(['approved', 'rejected'])
  decision!: 'approved' | 'rejected';

  @ValidateIf((body: ReviewSubscriptionReceiptDto) => body.decision === 'rejected')
  @IsString()
  @MaxLength(1000)
  rejectionReason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  adminNote?: string | null;
}

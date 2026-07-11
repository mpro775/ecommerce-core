import { IsIn, IsOptional, IsString, Matches } from 'class-validator';

const BILLING_CYCLES = ['monthly', 'annual'] as const;
const PRORATION_MODES = ['immediate_invoice', 'next_cycle_credit', 'none'] as const;

export class ChangeSubscriptionPlanDto {
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  targetPlanCode!: string;

  @IsOptional()
  @IsIn(BILLING_CYCLES)
  billingCycle?: (typeof BILLING_CYCLES)[number];

  @IsOptional()
  @IsIn(PRORATION_MODES)
  prorationMode?: (typeof PRORATION_MODES)[number];
}

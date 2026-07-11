import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

export class UpdateSubscriptionSettingsDto {
  @IsBoolean()
  signupTrialEnabled!: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  signupTrialPlanCode?: string | null;

  @IsInt()
  @Min(0)
  signupTrialDays!: number;

  @IsIn(['downgrade_to_free', 'mark_past_due', 'suspend_paid_features', 'create_invoice'])
  afterTrialBehavior!:
    | 'downgrade_to_free'
    | 'mark_past_due'
    | 'suspend_paid_features'
    | 'create_invoice';

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  freePlanCode?: string | null;

  @IsBoolean()
  allowTrialPlanChange!: boolean;

  @IsBoolean()
  oneTrialPerStore!: boolean;

  @IsBoolean()
  oneTrialPerOwner!: boolean;

  @IsBoolean()
  trialRequiresPaymentMethod!: boolean;

  @IsArray()
  @ArrayMaxSize(10)
  @IsInt({ each: true })
  @Min(1, { each: true })
  trialReminderDaysBefore!: number[];
}

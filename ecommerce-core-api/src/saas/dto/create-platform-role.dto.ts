import { IsArray, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreatePlatformRoleDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9]+(?:_[a-z0-9]+)*$/)
  @MaxLength(80)
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsArray()
  @IsString({ each: true })
  permissionKeys!: string[];
}

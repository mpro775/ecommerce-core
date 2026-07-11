import { Type } from 'class-transformer';
import { IsArray, IsObject, IsString, MaxLength, ValidateNested } from 'class-validator';

class PlatformSettingEntryDto {
  @IsString()
  @MaxLength(100)
  key!: string;

  @IsObject()
  value!: Record<string, unknown>;
}

export class UpdatePlatformSettingsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlatformSettingEntryDto)
  entries!: PlatformSettingEntryDto[];
}

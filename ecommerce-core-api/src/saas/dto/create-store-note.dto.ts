import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateStoreNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  type?: string;

  @IsString()
  @MaxLength(5000)
  body!: string;

  @IsOptional()
  @IsBoolean()
  pinned?: boolean;
}

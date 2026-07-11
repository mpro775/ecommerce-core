import { IsInt, Min } from 'class-validator';

export class RestoreTemplateVersionDto {
  @IsInt()
  @Min(1)
  version!: number;
}

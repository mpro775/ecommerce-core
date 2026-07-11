import { IsIn, IsOptional } from 'class-validator';

export class QaExportQueryDto {
  @IsOptional()
  @IsIn(['json', 'markdown'])
  format?: 'json' | 'markdown';
}

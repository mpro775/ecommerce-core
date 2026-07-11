import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength } from 'class-validator';

export class CreateDomainDto {
  @Transform(({ value }) =>
    String(value)
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .replace(/\.$/, ''),
  )
  @IsString()
  @MaxLength(253)
  @Matches(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/)
  hostname!: string;
}

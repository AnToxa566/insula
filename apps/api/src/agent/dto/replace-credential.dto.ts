import { ApiProperty } from '@nestjs/swagger';

import { IsString, MinLength } from 'class-validator';

import type { ReplaceCredentialInput } from '@insula/contracts';

export class ReplaceCredentialDto implements ReplaceCredentialInput {
  @ApiProperty({ description: 'The new provider API key. Validated before it replaces the old one.' })
  @IsString()
  @MinLength(1)
  apiKey!: string;
}

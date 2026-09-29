import { ApiProperty } from '@nestjs/swagger';

import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';

import type { QuickRegisterInput } from '@insula/contracts';

export class QuickRegisterDto implements QuickRegisterInput {
  @ApiProperty({ example: 'jane@example.com' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email!: string;
}

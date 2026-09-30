import { ApiProperty } from '@nestjs/swagger';

import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';

import type { PasswordResetRequestInput } from '@insula/contracts';

export class PasswordResetRequestDto implements PasswordResetRequestInput {
  @ApiProperty({ example: 'jane@example.com' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email!: string;
}

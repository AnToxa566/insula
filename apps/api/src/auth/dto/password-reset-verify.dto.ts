import { ApiProperty } from '@nestjs/swagger';

import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches } from 'class-validator';

import type { PasswordResetVerifyInput } from '@insula/contracts';

export class PasswordResetVerifyDto implements PasswordResetVerifyInput {
  @ApiProperty({ example: 'jane@example.com' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '482913', description: 'The 6-digit code from the email' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Code must be 6 digits' })
  code!: string;
}

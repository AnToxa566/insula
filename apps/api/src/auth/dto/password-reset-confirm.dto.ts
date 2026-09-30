import { ApiProperty } from '@nestjs/swagger';

import { IsString, MaxLength, MinLength } from 'class-validator';

import { PASSWORD_MIN_LENGTH, type PasswordResetConfirmInput } from '@insula/contracts';

export class PasswordResetConfirmDto implements PasswordResetConfirmInput {
  @ApiProperty({ description: 'The token returned by /auth/password-reset/verify' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  resetToken!: string;

  @ApiProperty({ minLength: PASSWORD_MIN_LENGTH, example: 'correcthorsebatterystaple' })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  newPassword!: string;
}

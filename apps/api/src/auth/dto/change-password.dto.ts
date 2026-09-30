import { ApiProperty } from '@nestjs/swagger';

import { IsString, MinLength } from 'class-validator';

import { PASSWORD_MIN_LENGTH, type ChangePasswordInput } from '@insula/contracts';

import { DiffersFromField } from './validators/differs-from-field.validator.js';

export class ChangePasswordDto implements ChangePasswordInput {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @ApiProperty({ minLength: PASSWORD_MIN_LENGTH, example: 'correcthorsebatterystaple' })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @DiffersFromField('currentPassword', {
    message: 'New password must differ from the current password',
  })
  newPassword!: string;
}

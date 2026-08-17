import { ApiProperty } from '@nestjs/swagger';

import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength, Validate } from 'class-validator';

import type { RegisterInput } from '@insula/contracts';

import { NotReservedHandleConstraint } from './validators/not-reserved-handle.validator.js';

const normalize = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterDto implements RegisterInput {
  @ApiProperty({ example: 'jane@example.com' })
  @Transform(normalize)
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8, example: 'correcthorsebatterystaple' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({
    example: 'jane_doe',
    minLength: 3,
    maxLength: 20,
    description: '3-20 chars, lowercase letters/digits/underscore only',
  })
  @Transform(normalize)
  @Matches(/^[a-z0-9_]{3,20}$/, {
    message: 'Handle must be 3-20 characters: lowercase letters, digits, underscore only',
  })
  @Validate(NotReservedHandleConstraint)
  handle!: string;

  @ApiProperty({ example: 'Jane Doe', maxLength: 50 })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  displayName!: string;
}

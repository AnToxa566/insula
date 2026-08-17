import { ApiProperty } from '@nestjs/swagger';

import { IsString, MinLength } from 'class-validator';

import type { LogoutInput } from '@insula/contracts';

export class LogoutDto implements LogoutInput {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  refreshToken!: string;
}

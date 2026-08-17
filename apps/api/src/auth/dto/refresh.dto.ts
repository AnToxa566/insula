import { ApiProperty } from '@nestjs/swagger';

import { IsString, MinLength } from 'class-validator';

import type { RefreshInput } from '@insula/contracts';

export class RefreshDto implements RefreshInput {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  refreshToken!: string;
}

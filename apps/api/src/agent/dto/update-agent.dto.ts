import { ApiPropertyOptional } from '@nestjs/swagger';

import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { AGENT_STATUSES } from '@insula/contracts';
import type { AgentStatus, UpdateAgentInput } from '@insula/contracts';

import { IsIanaTimezone } from './validators/is-iana-timezone.validator.js';

// Not `provider`, not `handle` — both immutable after creation. Omitting
// them from this class (rather than accepting-and-ignoring) means a client
// that sends either gets a 400 from ValidationPipe's forbidNonWhitelisted,
// not a silent no-op.
export class UpdateAgentDto implements UpdateAgentInput {
  @ApiPropertyOptional({ maxLength: 50 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  displayName?: string;

  @ApiPropertyOptional({ maxLength: 280 })
  @IsOptional()
  @IsString()
  @MaxLength(280)
  bio?: string;

  @ApiPropertyOptional({ type: [String], maxItems: 20 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(40, { each: true })
  interests?: string[];

  @ApiPropertyOptional({ type: [Number], maxItems: 24 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(24)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(23, { each: true })
  activeHours?: number[];

  @ApiPropertyOptional({ example: 'America/New_York' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @IsIanaTimezone()
  timezone?: string;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @IsPositive()
  dailyTokenLimit?: number;

  @ApiPropertyOptional({ example: 'claude-sonnet-5' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  model?: string;

  @ApiPropertyOptional({ enum: AGENT_STATUSES })
  @IsOptional()
  @IsIn(AGENT_STATUSES)
  status?: AgentStatus;
}

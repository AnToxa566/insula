import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  Validate,
} from 'class-validator';

import { LLM_PROVIDERS } from '@insula/contracts';
import type { CreateAgentInput, LlmProvider } from '@insula/contracts';

import { NotReservedHandleConstraint } from '../../auth/dto/validators/not-reserved-handle.validator.js';
import { IsIanaTimezone } from './validators/is-iana-timezone.validator.js';

const normalizeHandle = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class CreateAgentDto implements CreateAgentInput {
  // Same handle rules as user registration (RegisterDto): reuses the
  // reserved-handle list from @insula/contracts so the two can never drift.
  @ApiProperty({
    example: 'newsbot',
    minLength: 3,
    maxLength: 20,
    description: '3-20 chars, lowercase letters/digits/underscore only',
  })
  @Transform(normalizeHandle)
  @Matches(/^[a-z0-9_]{3,20}$/, {
    message: 'Handle must be 3-20 characters: lowercase letters, digits, underscore only',
  })
  @Validate(NotReservedHandleConstraint)
  handle!: string;

  @ApiProperty({ example: 'News Bot', maxLength: 50 })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  displayName!: string;

  @ApiPropertyOptional({ maxLength: 280 })
  @IsOptional()
  @IsString()
  @MaxLength(280)
  bio?: string;

  @ApiProperty({ enum: LLM_PROVIDERS })
  @IsIn(LLM_PROVIDERS)
  provider!: LlmProvider;

  @ApiProperty({ example: 'claude-sonnet-5' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  model!: string;

  // Never persisted as-is: validated against the provider, then
  // envelope-encrypted (apps/api/src/crypto) before anything hits the
  // database. Never returned in any response.
  @ApiProperty({ description: "The provider API key. Validated before the agent is created; never stored in plaintext, never echoed back." })
  @IsString()
  @MinLength(1)
  apiKey!: string;

  @ApiProperty({ type: [String], maxItems: 20 })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(40, { each: true })
  interests!: string[];

  @ApiProperty({
    type: [Number],
    maxItems: 24,
    description: 'Hours (0-23) the agent is allowed to be active. Stored only — not yet enforced.',
  })
  @IsArray()
  @ArrayMaxSize(24)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(23, { each: true })
  activeHours!: number[];

  @ApiProperty({ example: 'America/New_York', description: 'IANA timezone name' })
  @IsString()
  @MinLength(1)
  @IsIanaTimezone()
  timezone!: string;

  @ApiPropertyOptional({ minimum: 1, description: 'Defaults to the schema default (50000) when omitted.' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  dailyTokenLimit?: number;
}

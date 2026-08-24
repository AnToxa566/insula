import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

import type { CreatePostInput } from '@insula/contracts';

export class CreatePostDto implements CreatePostInput {
  @ApiProperty({ minLength: 1, maxLength: 1000, example: 'Just shipped the social module.' })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  body!: string;

  @ApiPropertyOptional({
    type: [String],
    maxItems: 4,
    description: 'Up to 4 media URLs. No upload — URLs only, buckets come later.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsUrl({}, { each: true })
  mediaUrls?: string[];
}

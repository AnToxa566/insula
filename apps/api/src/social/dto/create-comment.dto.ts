import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

import type { CreateCommentInput } from '@insula/contracts';

export class CreateCommentDto implements CreateCommentInput {
  @ApiProperty({ minLength: 1, maxLength: 500, example: 'Nice work!' })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  body!: string;

  @ApiPropertyOptional({
    description:
      'Id of the comment being replied to. Must be a root comment (one level of nesting only) on the same post — enforced in CommentsService, not here.',
  })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}

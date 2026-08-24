import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import type { CommentResponse, CursorPage } from '@insula/contracts';

import { ProfileSummaryDto } from './profile-summary.dto.js';

export class CommentResponseDto implements CommentResponse {
  @ApiProperty() id!: string;
  @ApiProperty() body!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty({ type: ProfileSummaryDto }) author!: ProfileSummaryDto;
  @ApiProperty() likeCount!: number;
  @ApiProperty() likedByMe!: boolean;
  @ApiProperty({ type: String, nullable: true }) parentId!: string | null;

  @ApiPropertyOptional({
    type: [CommentResponseDto],
    description: 'Only populated on root comments returned from GET /posts/:id/comments.',
  })
  replies?: CommentResponseDto[];
}

export class CommentPageDto implements CursorPage<CommentResponse> {
  @ApiProperty({ type: [CommentResponseDto] }) items!: CommentResponseDto[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}

import { ApiProperty } from '@nestjs/swagger';

import type { CursorPage, PostResponse } from '@insula/contracts';

import { ProfileSummaryDto } from './profile-summary.dto.js';

export class PostResponseDto implements PostResponse {
  @ApiProperty() id!: string;
  @ApiProperty() body!: string;
  @ApiProperty({ type: [String] }) mediaUrls!: string[];
  @ApiProperty() createdAt!: string;
  @ApiProperty({ type: ProfileSummaryDto }) author!: ProfileSummaryDto;
  @ApiProperty() likeCount!: number;
  @ApiProperty() commentCount!: number;
  @ApiProperty() likedByMe!: boolean;
}

export class PostPageDto implements CursorPage<PostResponse> {
  @ApiProperty({ type: [PostResponseDto] }) items!: PostResponseDto[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}

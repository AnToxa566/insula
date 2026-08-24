import { ApiProperty } from '@nestjs/swagger';

import type { CursorPage, ProfileSummary } from '@insula/contracts';

import { ProfileSummaryDto } from './profile-summary.dto.js';

// Used for GET /profiles/:handle/followers and /following.
export class ProfileSummaryPageDto implements CursorPage<ProfileSummary> {
  @ApiProperty({ type: [ProfileSummaryDto] }) items!: ProfileSummaryDto[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}

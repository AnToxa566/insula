import { ApiProperty } from '@nestjs/swagger';

import type { ProfileSummary, ProfileType } from '@insula/contracts';

// Swagger-only — used exclusively as an @ApiResponse({ type }) target.
// Controllers return plain contracts-typed objects; TS structural typing
// accepts them against this class without any runtime instantiation.
export class ProfileSummaryDto implements ProfileSummary {
  @ApiProperty() id!: string;
  @ApiProperty() handle!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty() avatarSeed!: string;
  @ApiProperty({ type: String, nullable: true }) avatarUrl!: string | null;
  @ApiProperty({ enum: ['USER', 'AGENT'] }) type!: ProfileType;
}

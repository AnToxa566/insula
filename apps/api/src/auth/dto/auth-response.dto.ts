import { ApiProperty } from '@nestjs/swagger';

import type { AuthUser, AuthUserProfile, LoginResponse, ProfileType } from '@insula/contracts';

// Swagger-only response shapes — used exclusively as @ApiResponse({ type })
// targets. Controllers return the plain contracts-typed object; TS
// structural typing accepts it against these classes without any runtime
// instantiation.
export class AuthUserProfileDto implements AuthUserProfile {
  @ApiProperty() id!: string;
  @ApiProperty() handle!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty() avatarSeed!: string;
  @ApiProperty({ enum: ['USER', 'AGENT'] }) type!: ProfileType;
}

export class AuthUserDto implements AuthUser {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ type: AuthUserProfileDto }) profile!: AuthUserProfileDto;
}

export class AuthResponseDto implements LoginResponse {
  @ApiProperty() accessToken!: string;
  @ApiProperty() refreshToken!: string;
  @ApiProperty({ type: AuthUserDto }) user!: AuthUserDto;
}

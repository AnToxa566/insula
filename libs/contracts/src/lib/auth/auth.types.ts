// Response shapes and the access-token payload shared between the API
// (issuance), libs/auth (verification), and eventually the web client.
// Deliberately not imported from @insula/db — libs/contracts imports nothing
// internal, so the ProfileType union is redeclared here rather than reused.
export type ProfileType = 'USER' | 'AGENT';

export interface AuthUserProfile {
  id: string;
  handle: string;
  displayName: string;
  avatarSeed: string;
  type: ProfileType;
}

export interface AuthUser {
  id: string;
  email: string;
  profile: AuthUserProfile;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export type RegisterResponse = LoginResponse;

// The decoded shape of an access token. `type` is a literal today because
// only user accounts can authenticate; it becomes a union once agent
// service tokens exist (see the comment in libs/auth's JwtAuthGuard).
export interface AccessTokenPayload {
  sub: string;
  profileId: string;
  handle: string;
  type: 'user';
}

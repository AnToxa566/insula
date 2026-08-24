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

// The decoded shape of a user access token. Issued by apps/api/src/auth
// (state: writes a RefreshToken row), verified by libs/auth's JwtAuthGuard
// against JWT_ACCESS_SECRET.
export interface AccessTokenPayload {
  sub: string;
  profileId: string;
  handle: string;
  type: 'user';
}

// The decoded shape of an agent service token. Signed by
// libs/auth#signAgentToken (stateless — no DB write) using
// AGENT_SERVICE_SECRET, TTL 5 minutes. `sub` is the agent id, never the
// owning user's id — an agent's identity is its own, not its owner's.
export interface AgentTokenPayload {
  sub: string;
  profileId: string;
  type: 'agent';
}

// What JwtAuthGuard attaches to `request.principal` after verifying either
// token type. `profileId` is common to both variants specifically so social
// service methods (which only ever take a profileId) don't need to know or
// care which kind of caller they're serving.
export type Principal =
  | { type: 'user'; userId: string; profileId: string }
  | { type: 'agent'; agentId: string; profileId: string };

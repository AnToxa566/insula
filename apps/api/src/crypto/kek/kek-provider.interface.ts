// Abstracts the key-encryption-key backend so it's swappable without a data
// migration. Every AgentCredential row stores which version wrapped its DEK
// (`kekVersion`) — unwrap always receives that stored version and must
// never assume "whatever is active now", so old rows stay readable across a
// provider change. See SECURITY.md's envelope-encryption checklist.
export interface KekProvider {
  readonly version: string;
  wrap(dek: Buffer): Promise<Buffer>;
  unwrap(wrapped: Buffer, version: string): Promise<Buffer>;
}

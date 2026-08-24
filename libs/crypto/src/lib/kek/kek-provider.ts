// Abstracts the key-encryption-key backend so it's swappable without a data
// migration. Every AgentCredential row stores which version wrapped its DEK
// (`kekVersion`) — unwrap always receives that stored version and must
// never assume "whatever is active now", so old rows stay readable across a
// provider change. See SECURITY.md's envelope-encryption checklist.
//
// Implementations are runtime-specific and live where their SDK lives:
// LocalKekProvider (below) is pure WebCrypto and belongs here; a Node-only
// KMS provider using the GCP SDK, or a Worker one calling the KMS REST API
// with fetch, both implement this interface from their own runtime's app
// code instead.
export interface KekProvider {
  readonly version: string;
  wrap(dek: Uint8Array): Promise<Uint8Array>;
  unwrap(wrapped: Uint8Array, version: string): Promise<Uint8Array>;
}

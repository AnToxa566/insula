import type { KekProvider } from './kek-provider.interface.js';

// GCP Cloud KMS envelope encryption — the production target from
// SECURITY.md's checklist ("KEK lives in GCP Cloud KMS and never leaves
// it"). Not wired yet: no @google-cloud/kms dependency, no call to
// kms.encrypt/decrypt. Selecting KEK_PROVIDER=kms gets you this class with a
// clear failure instead of a silent fallback to the local provider — a
// swapped-in KEK that quietly isn't there would be far worse than a boot
// error.
//
// Wiring this up later is meant to cost exactly: add the SDK dependency,
// implement wrap()/unwrap() against a configured key resource name, and
// flip KEK_PROVIDER=kms. Nothing else in the credential path changes.
export class KmsKekProvider implements KekProvider {
  readonly version = 'kms-v1';

  // Parameters intentionally unnamed: nothing is read before throwing, and
  // an implementation with fewer parameters than the interface still
  // satisfies KekProvider structurally.
  async wrap(): Promise<Buffer> {
    throw new Error(
      'KmsKekProvider is not configured: GCP Cloud KMS is not wired up yet. Set KEK_PROVIDER=local.',
    );
  }

  async unwrap(): Promise<Buffer> {
    throw new Error(
      'KmsKekProvider is not configured: GCP Cloud KMS is not wired up yet. Set KEK_PROVIDER=local.',
    );
  }
}

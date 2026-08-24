# @insula/crypto

Envelope encryption for stored credentials — `sealCredential` / `openCredential`,
plus the `KekProvider` interface and its local (WebCrypto AES-256-GCM)
implementation.

This library has no NestJS, no Prisma, and no `node:crypto` — only
`crypto.subtle`/`crypto.getRandomValues`. It runs unmodified on both the API
(Node, Cloud Run) and the future agent runtime (a Cloudflare Workers isolate).
See [ARCHITECTURE.md](../../ARCHITECTURE.md) and
[SECURITY.md](../../SECURITY.md) at the repo root for why the split exists and
what it buys.

Configuration (KEK provider, keys) is the caller's job — see
`apps/api/src/crypto` for the NestJS wrapper that reads `KEK_PROVIDER` /
`CREDENTIAL_ENCRYPTION_KEY` and delegates here.

## Layout

- `envelope.ts` — `sealCredential` / `openCredential`
- `aes.ts` — AES-256-GCM primitives over `crypto.subtle`
- `kek/kek-provider.ts` — the `KekProvider` interface
- `kek/local-kek-provider.ts` — the local (dev/v0) `KekProvider`
- `types.ts` — `SealedCredential`, `EncryptResult`

A KMS-backed `KekProvider` does **not** belong here — it lives in the app that
calls it (`apps/api/src/crypto/kms-kek-provider.ts` for the GCP Node SDK; the
Worker will call the KMS REST API with `fetch`).

## Running unit tests

Run `nx test crypto` to execute the unit tests via [Jest](https://jestjs.io).

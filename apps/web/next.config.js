//@ts-check
const contracts = '../../libs/contracts/src/lib';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next.js options go here
  // See: https://nextjs.org/docs/app/api-reference/config/next-config-js

  // @insula/contracts uses TypeScript's "nodenext" module resolution, whose
  // relative imports end in `.js` while the file on disk is `.ts` — required
  // for its tsc/ts-node consumers (apps/api, apps/agent-runtime). Turbopack
  // resolves specifiers literally with no ".js means .ts" fallback (neither
  // `transpilePackages` nor a wildcard `resolveAlias` changes that), so every
  // one of its internal relative imports needs its own entry here. This is a
  // stopgap: apps/web is the first Turbopack-bundled consumer of contracts,
  // and the real fix is giving contracts a compiled dist build (the
  // `@insula/source` custom condition already sitting unused in
  // tsconfig.base.json looks like it was meant for exactly this). Revisit
  // this list if contracts grows new top-level files, or once that build
  // step exists.
  transpilePackages: ['@insula/contracts'],
  turbopack: {
    resolveAlias: {
      './lib/auth/index.js': `${contracts}/auth/index.ts`,
      './lib/social/index.js': `${contracts}/social/index.ts`,
      './lib/agent/index.js': `${contracts}/agent/index.ts`,
      './auth.types.js': `${contracts}/auth/auth.types.ts`,
      './auth.schemas.js': `${contracts}/auth/auth.schemas.ts`,
      './reserved-handles.js': `${contracts}/auth/reserved-handles.ts`,
      './agent.types.js': `${contracts}/agent/agent.types.ts`,
      './agent.schemas.js': `${contracts}/agent/agent.schemas.ts`,
      './social.types.js': `${contracts}/social/social.types.ts`,
      './social.schemas.js': `${contracts}/social/social.schemas.ts`,
      '../auth/auth.types.js': `${contracts}/auth/auth.types.ts`,
      '../auth/auth.schemas.js': `${contracts}/auth/auth.schemas.ts`,
    },
  },
};

module.exports = nextConfig;

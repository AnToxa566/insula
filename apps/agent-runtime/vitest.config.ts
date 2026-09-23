import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

import { TEST_BINDINGS } from './test/bindings.js';

// Tests run inside workerd — the real Workers runtime — not Node. Bindings
// set here take precedence over wrangler.jsonc and .dev.vars, so no local
// secret is ever needed (or read) to run the suite.
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: { bindings: { ...TEST_BINDINGS } },
    }),
  ],
  test: {
    include: ['test/**/*.spec.ts'],
  },
});

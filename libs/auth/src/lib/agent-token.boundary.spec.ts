import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// agent-token.ts is imported on its own by the agent runtime, a Workers V8
// isolate, through the `@insula/auth/agent-token` subpath. The rest of this
// package is NestJS + jsonwebtoken and cannot be bundled there. A stray
// import in this one file would break the runtime's build — or worse, pull
// the whole Nest graph into the Worker — so this checks the source directly
// rather than trusting review to catch it.
//
// (This spec itself uses node:fs/node:path — that's Jest tooling under Node,
// not shipped code.)
describe('agent-token runtime boundary', () => {
  const source = readFileSync(join(__dirname, 'agent-token.ts'), 'utf8');
  const imports = [...source.matchAll(/(?:from|import|require\()\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);

  it('imports only types from @insula/contracts', () => {
    expect(imports).toEqual(['@insula/contracts']);
    expect(source).toMatch(/import type \{[^}]+\} from '@insula\/contracts';/);
  });

  it('has no Node, NestJS, or jsonwebtoken import', () => {
    for (const specifier of imports) {
      expect(specifier).not.toMatch(/^node:|^@nestjs\/|^jsonwebtoken$/);
    }
  });
});

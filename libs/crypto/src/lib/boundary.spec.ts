import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// This library is imported by both a NestJS app (Node on Cloud Run) and a
// Workers V8 isolate — see the package README / AGENTS.md. node:crypto and
// friends are Node-only, so a `node:` import anywhere in the shipped source
// would silently break in Workers. This walks the actual source tree rather
// than trusting review to catch a stray import.
//
// (This spec file itself uses node:fs/node:path to do the walking — that's
// test tooling that runs under Jest/Node, not shipped library code, so it's
// excluded from the scan below alongside every other *.spec.ts file.)
function collectSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...collectSourceFiles(full));
    } else if (full.endsWith('.ts') && !full.endsWith('.spec.ts')) {
      files.push(full);
    }
  }
  return files;
}

describe('runtime boundary', () => {
  it('imports nothing from node: anywhere in the shipped source', () => {
    const srcDir = join(__dirname, '..');
    const files = collectSourceFiles(srcDir);
    expect(files.length).toBeGreaterThan(0);

    const offenders = files
      .map((file) => ({ file, content: readFileSync(file, 'utf8') }))
      .filter(({ content }) => /(?:from|require\()\s*['"]node:/.test(content))
      .map(({ file }) => file);

    expect(offenders).toEqual([]);
  });
});

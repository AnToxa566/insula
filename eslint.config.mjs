import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist', '**/out-tsc'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            // Leaf-only: libs/contracts imports nothing internal.
            { sourceTag: 'type:contract', onlyDependOnLibsWithTags: [] },
            // libs/auth, libs/db: may depend only on contracts. This is
            // what makes libs/auth importing Prisma or apps/* a lint error,
            // not just a documented promise.
            { sourceTag: 'type:util', onlyDependOnLibsWithTags: ['type:contract'] },
            { sourceTag: 'type:data', onlyDependOnLibsWithTags: ['type:contract'] },
            { sourceTag: 'type:ui', onlyDependOnLibsWithTags: ['type:contract'] },
            {
              sourceTag: 'type:app',
              onlyDependOnLibsWithTags: ['type:contract', 'type:util', 'type:data', 'type:ui'],
            },
            // Each future service only reaches its own scope plus shared libs.
            { sourceTag: 'scope:web', onlyDependOnLibsWithTags: ['scope:web', 'scope:shared'] },
            { sourceTag: 'scope:api', onlyDependOnLibsWithTags: ['scope:api', 'scope:shared'] },
            {
              sourceTag: 'scope:agent',
              onlyDependOnLibsWithTags: ['scope:agent', 'scope:shared'],
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    // Override or add rules here
    rules: {},
  },
];

// Integration specs that talk to the real Postgres (DATABASE_URL from the
// workspace-root .env). Kept out of jest.config.cts so `nx test @insula/api`
// stays DB-free; run through `nx run @insula/api:test-db`, which `nx e2e
// @insula/api-e2e` also depends on. Must run with the workspace root as cwd
// so `dotenv/config` finds the root .env.
const { readFileSync } = require('fs');

const swcJestConfig = JSON.parse(
  readFileSync(`${__dirname}/.spec.swcrc`, 'utf-8'),
);
swcJestConfig.swcrc = false;

module.exports = {
  displayName: '@insula/api (db)',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.db.spec.ts'],
  setupFiles: ['dotenv/config'],
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: 'test-output/jest/coverage-db',
};

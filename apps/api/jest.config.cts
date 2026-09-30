/* eslint-disable */
const { readFileSync } = require('fs');

// Reading the SWC compilation config for the spec files
const swcJestConfig = JSON.parse(
  readFileSync(`${__dirname}/.spec.swcrc`, 'utf-8'),
);

// Disable .swcrc look-up by SWC core because we're passing in swcJestConfig ourselves
swcJestConfig.swcrc = false;

module.exports = {
  displayName: '@insula/api',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  // `*.db.spec.ts` need the real Postgres; they run via the `test-db` target
  // (jest.db.config.cts), not in the DB-free unit run.
  testPathIgnorePatterns: ['/node_modules/', '\\.db\\.spec\\.ts$'],
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: 'test-output/jest/coverage',
};

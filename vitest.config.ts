import { setup } from '@ark/attest'
import { configDefaults, defineConfig } from 'vitest/config'

const ssrResolveConditions = [
  'module',
  ...(process.versions.bun ? ['bun'] : []),
  'node',
  'development|production',
]

const testExclude = [
  ...configDefaults.exclude,
  '.claude/**',
  '**/build/**',
  '**/*.demo.{js,jsx,ts,tsx,mjs,mts,cjs,cts}',
  'tools/oxlint-custom-rules/tests/fixtures/**',
  '**/*.test-d.ts',
]

const coverageExclude = [
  '**/*.d.ts',
  '**/*.test-d.ts',
  '**/*.test-helpers.ts',
  '**/*.demo.{js,jsx,ts,tsx,mjs,mts,cjs,cts}',
  '**/*.{test,spec}.{js,jsx,ts,tsx,mjs,mts,cjs,cts}',
  '**/__tests/**',
  '**/__tests__/**',
  '**/__snapshots__/**',
  '**/__mocks__/**',
  '**/__examples__/**',
  '**/build/**',
  '.claude/**',
  'tools/oxlint-custom-rules/tests/fixtures/**',
]

const repoRoot = import.meta.dirname
const packageRelativeRoot = process.cwd().replace(`${repoRoot}/`, ``)
const packageSpecificCoverageExclude =
  packageRelativeRoot === 'packages/kitz' || packageRelativeRoot === 'packages/platform'
    ? ['src/**/*.ts']
    : []

// Run attest type checking only when explicitly requested via ATTEST env var
if (process.env[`ATTEST`] === `true`) {
  setup()
}

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      // Circular devDep workaround - see .claude/rules/circular-devdep-workaround.md
      '#kitz/test/test': `${repoRoot}/packages/test/src/__.ts`,
      '#kitz/test': `${repoRoot}/packages/test/src/_.ts`,
      '#kitz/assert/assert': `${repoRoot}/packages/assert/src/__.ts`,
      '#kitz/assert': `${repoRoot}/packages/assert/src/_.ts`,
    },
  },
  test: {
    globals: false,
    globalSetup: [`${repoRoot}/vitest.global-setup.ts`],
    include: configDefaults.include,
    exclude: testExclude,
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      exclude: [...coverageExclude, ...packageSpecificCoverageExclude],
      thresholds: {
        perFile: true,
        lines: 70,
        functions: 70,
      },
    },
  },
  ssr: {
    resolve: {
      conditions: ssrResolveConditions,
    },
  },
})

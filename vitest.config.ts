import { setup } from '@ark/attest'
import path from 'node:path'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

// Run attest type checking only when explicitly requested via ATTEST env var
if (process.env[`ATTEST`] === `true`) {
  setup()
}

export default defineConfig({
  // TODO: Remove cast when fixed: https://github.com/vitest-dev/vitest/issues/9126
  plugins: [tsconfigPaths() as any],
  resolve: {
    alias: {
      // Circular devDep workaround - see .claude/rules/circular-devdep-workaround.md
      '#kitz/test/test': path.resolve(__dirname, 'packages/test/src/__.ts'),
      '#kitz/test': path.resolve(__dirname, 'packages/test/src/_.ts'),
      '#kitz/assert/assert': path.resolve(__dirname, 'packages/assert/src/__.ts'),
      '#kitz/assert': path.resolve(__dirname, 'packages/assert/src/_.ts'),
    },
  },
  test: {
    globals: false,
    globalSetup: ['./vitest.global-setup.ts'],
  },
})

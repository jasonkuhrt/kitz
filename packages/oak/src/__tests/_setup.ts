// Test preload — runs before each test to clear ambient env that the oak
// parser would otherwise read. bun:test inherits the parent shell's env and
// doesn't isolate per-file the way vitest's forked workers did, so any
// CLI_PARAM_* / CLI_PARAMETER_* / CLI_SETTINGS_* var leaking from the user's
// shell or from a previous test pollutes parser assertions.
import { beforeEach } from 'bun:test'

// Globally neuter process.exit so tests that hit error paths (which call
// process.exit) don't actually terminate the test process. Multiple test files
// individually spy on process.exit; under bun:test those spies persist
// in-process across files, so doing it once globally avoids per-file mock
// management and mock-restore order-dependence.
;(process as unknown as { exit: (code?: number | string | null) => never }).exit = ((
  _code?: number | string | null,
) => undefined as never) as typeof process.exit

beforeEach(() => {
  // Clear ambient CLI_* envs that bun:test would otherwise inherit from the
  // parent shell or from prior tests in the same process. The oak parser
  // intentionally reads CLI_PARAM_* / CLI_PARAMETER_* / CLI_SETTINGS_* envs
  // by design, so any stray value pollutes the parser's assertions.
  for (const key of Object.keys(process.env)) {
    const upper = key.toUpperCase()
    if (
      upper.startsWith('CLI_PARAM_') ||
      upper.startsWith('CLI_PARAMETER_') ||
      upper.startsWith('CLI_SETTINGS_')
    ) {
      delete process.env[key]
    }
  }
})

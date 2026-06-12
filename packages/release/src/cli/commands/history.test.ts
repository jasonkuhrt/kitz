import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { describe, expect, test } from 'bun:test'

const cliPath = path.resolve(import.meta.dir, '../cli.ts')

const runHistory = (args: readonly string[]) =>
  spawnSync('bun', [cliPath, 'history', ...args], { encoding: 'utf8' })

// Integer validation moved from hand-rolled parsing onto the CLI framework
// (Flag.integer + Flag.withSchema). These pin the rejection behavior the old
// parsePositiveIntegerOption tests covered.
describe('release history flag validation', () => {
  test.each([
    ['--pr', 'abc'],
    ['--pr', '0'],
    ['--pr', '-1'],
    ['--pr', '3.14'],
    ['--limit', '0'],
    ['--limit', 'abc'],
  ])(
    'rejects %s %s through the framework validation channel',
    (flag, value) => {
      const result = runHistory([flag, value])

      expect(result.status).not.toBe(0)
    },
    20_000,
  )
})

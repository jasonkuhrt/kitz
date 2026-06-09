import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { describe, expect, test } from 'bun:test'

const cliPath = path.resolve(import.meta.dir, '../cli.ts')
const repoRoot = path.resolve(import.meta.dir, '../../../../../')

describe('release doctor command', () => {
  test('reports missing custom plans without runtime error noise', () => {
    const result = spawnSync('bun', [cliPath, 'doctor', '--from', './.release/missing.json'], {
      cwd: repoRoot,
      encoding: 'utf8',
    })
    const output = `${result.stdout}\n${result.stderr}`

    expect(result.status).toBe(1)
    expect(output).toContain('Release plan not found')
    for (const noise of ['DoctorFailures', 'ERROR (#']) expect(output).not.toContain(noise)
  })
})

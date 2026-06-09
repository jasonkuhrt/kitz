import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import * as Api from '../../api/__.js'

const cliPath = path.resolve(import.meta.dir, '../cli.ts')
const plan = Api.Planner.Plan.make({
  lifecycle: 'official',
  timestamp: '2026-06-09T00:00:00.000Z',
  releases: [],
  cascades: [],
  planDigest: Api.ReleaseContract.PlanDigest.make({
    algorithm: 'sha256',
    value: 'a'.repeat(64),
  }),
  publishIntent: Api.ReleaseContract.publishIntentFromSemantics({
    semantics: Api.Publishing.resolvePublishSemantics({ lifecycle: 'official' }),
    trunk: 'main',
  }),
})
const encodedPlan = `${JSON.stringify(Schema.encodeSync(Api.Planner.Plan)(plan), null, 2)}\n`
const digest = Api.Proof.digestForPlan(plan)
const lockFile = (rootDir: string) =>
  path.join(rootDir, '.release', 'locks', `${digest.value}.json`)
const writePlan = (rootDir: string) => {
  mkdirSync(path.join(rootDir, '.release'), { recursive: true })
  writeFileSync(path.join(rootDir, '.release', 'plan.json'), encodedPlan)
}
const withFixture = (name: string, run: (rootDir: string) => void) => {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), `kitz-release-apply-${name}-`))

  try {
    writePlan(rootDir)
    run(rootDir)
  } finally {
    rmSync(rootDir, { recursive: true, force: true })
  }
}
const runApply = (rootDir: string, args: readonly string[], input?: string) =>
  spawnSync('bun', [cliPath, 'apply', '--from', './.release/plan.json', ...args], {
    cwd: rootDir,
    encoding: 'utf8',
    input,
  })
const writeActiveLock = (rootDir: string) => {
  mkdirSync(path.dirname(lockFile(rootDir)), { recursive: true })
  writeFileSync(
    lockFile(rootDir),
    `${JSON.stringify(
      Schema.encodeSync(Api.ReleaseContract.ExecutionLock)(
        Api.Lock.make({
          planDigest: digest,
          ownerId: 'other',
          acquiredAt: new Date(Date.now() + 60_000).toISOString(),
          ttlSeconds: 3_600,
        }),
      ),
      null,
      2,
    )}\n`,
  )
}

describe('release apply command', () => {
  test('does not leave a release lock when the confirmation prompt is declined', () => {
    withFixture('cancel', (rootDir) => {
      const result = runApply(rootDir, [], 'n\n')

      expect(result.status).toBe(1)
      expect(result.stdout).toContain('Release canceled.')
      expect(existsSync(lockFile(rootDir))).toBe(false)
    })
  })

  test('checks the release lock before locked validation can continue', () => {
    withFixture('locked', (rootDir) => {
      writeActiveLock(rootDir)
      const result = runApply(rootDir, ['--yes'])
      const output = `${result.stdout}\n${result.stderr}`

      expect(result.status).toBe(1)
      expect(output).toContain('Active release lock already exists')
      expect(output).not.toContain('Plan-bound proof is missing')
    })
  })
})

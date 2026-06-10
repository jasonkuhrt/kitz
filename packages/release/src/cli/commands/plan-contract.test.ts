import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, test } from 'bun:test'
import * as Api from '../../api/__.js'

const cliPath = path.resolve(import.meta.dir, '../cli.ts')
const stalePlan = `${JSON.stringify(Api.Planner.Plan.encodeSync(Api.Planner.Plan.empty), null, 2)}\n`
const unsupportedContractMessage = 'This release plan is missing the frozen v2 execution contract.'

const withStalePlan = (run: (rootDir: string) => void): void => {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), 'kitz-release-plan-contract-'))
  try {
    mkdirSync(path.join(rootDir, '.release'), { recursive: true })
    writeFileSync(path.join(rootDir, '.release', 'stale-plan.json'), stalePlan)
    run(rootDir)
  } finally {
    rmSync(rootDir, { recursive: true, force: true })
  }
}

const runRelease = (rootDir: string, args: readonly string[]) =>
  spawnSync('bun', [cliPath, ...args], { cwd: rootDir, encoding: 'utf8' })

const planBoundCommands = [
  'apply --yes',
  'resume --yes',
  'status',
  'graph',
  'prove',
  'rehearse',
  'reconcile',
  'repair',
  'archive export',
]

describe('release plan execution contract', () => {
  test('plan-bound commands reject stale plans while preview can inspect them', () => {
    withStalePlan((rootDir) => {
      for (const command of planBoundCommands) {
        const args = [...command.split(' '), '--from', './.release/stale-plan.json']
        const result = runRelease(rootDir, args)

        expect(result.status).toBe(1)
        expect(`${result.stdout}\n${result.stderr}`).toContain(unsupportedContractMessage)
        if (command === 'prove') {
          expect(existsSync(path.join(rootDir, '.release', 'proofs'))).toBe(false)
        }
      }
      const result = runRelease(rootDir, ['preview', '--from', './.release/stale-plan.json'])

      expect(result.status).toBe(0)
      expect(`${result.stdout}\n${result.stderr}`).not.toContain(unsupportedContractMessage)
      expect(`${result.stdout}\n${result.stderr}`).toContain('No releases planned.')
    })
  }, 15_000)
})

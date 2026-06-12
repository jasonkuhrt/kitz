import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { describe, expect, test } from 'bun:test'

const cliPath = path.resolve(import.meta.dir, '../cli.ts')

const runTrust = (args: readonly string[]) =>
  spawnSync('bun', [cliPath, 'trust', ...args], { encoding: 'utf8' })

describe('release trust command surface', () => {
  // Regression: `trust verify` verified nothing (it printed a message and
  // exited) and was removed entirely. The command list must not resurrect it.
  test('exposes list and setup, and verify is gone', () => {
    const help = runTrust(['--help'])
    const output = `${help.stdout}\n${help.stderr}`

    expect(output).toContain('list')
    expect(output).toContain('setup')
    expect(output).not.toContain('verify')

    const verify = runTrust(['verify', '--from', './plan.json'])
    expect(verify.status).not.toBe(0)
  }, 20_000)

  test('setup requires a provider subcommand with framework-required flags', () => {
    const help = runTrust(['setup', '--help'])
    const output = `${help.stdout}\n${help.stderr}`
    for (const provider of ['github', 'gitlab', 'circleci']) {
      expect(output).toContain(provider)
    }

    // Missing required --workflow/--repo is rejected by the framework, not
    // by hand-rolled checks.
    const missing = runTrust(['setup', 'github', '--pkg', '@kitz/core'])
    expect(missing.status).not.toBe(0)

    const ok = runTrust([
      'setup',
      'github',
      '--pkg',
      '@kitz/core',
      '--workflow',
      'release.yml',
      '--repo',
      'jasonkuhrt/kitz',
    ])
    expect(ok.status).toBe(0)
    expect(ok.stdout).toContain(
      'npm trust github @kitz/core --repository jasonkuhrt/kitz --file release.yml',
    )
  }, 20_000)
})

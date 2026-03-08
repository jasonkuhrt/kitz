#!/usr/bin/env bun

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const runStatus = (args: readonly string[], cwd: string): number =>
  spawnSync('git', args, {
    cwd,
    stdio: 'ignore',
    env: process.env,
  }).status ?? 1

const runText = (
  args: readonly string[],
  cwd: string,
  options: { readonly allowFailure?: boolean } = {},
): string => {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: process.env,
  })

  if (result.status !== 0) {
    if (options.allowFailure) {
      return ''
    }

    const detail = result.stderr || result.stdout || `git ${args.join(' ')} failed`
    throw new Error(detail.trim())
  }

  return result.stdout.trim()
}

const cwd = process.cwd()
const hookPath = '.githooks'
const preCommitPath = join(cwd, hookPath, 'pre-commit')

if (!existsSync(preCommitPath)) {
  process.exit(0)
}

if (runStatus(['rev-parse', '--is-inside-work-tree'], cwd) !== 0) {
  process.exit(0)
}

const currentHookPath = runText(['config', '--get', 'core.hooksPath'], cwd, {
  allowFailure: true,
})
if (currentHookPath === hookPath) {
  process.exit(0)
}

const setResult = spawnSync('git', ['config', 'core.hooksPath', hookPath], {
  cwd,
  stdio: 'inherit',
  env: process.env,
})

process.exit(setResult.status ?? 1)

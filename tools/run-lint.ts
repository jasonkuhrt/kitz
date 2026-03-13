#!/usr/bin/env bun

// oxlint-disable-next-line kitz/module/no-nodejs-builtins
import { existsSync } from 'node:fs'
// oxlint-disable-next-line kitz/module/no-nodejs-builtins
import { extname, join } from 'node:path'
// oxlint-disable-next-line kitz/module/no-nodejs-builtins
import { spawnSync } from 'node:child_process'

const repoRoot = process.cwd()
const oxlintBin = join(repoRoot, 'node_modules', '.bin', 'oxlint')
const args = process.argv.slice(2)
const explicitTargetSeparator = args.indexOf('--')

const optionArgs = explicitTargetSeparator === -1 ? args : args.slice(0, explicitTargetSeparator)
const explicitTargets =
  explicitTargetSeparator === -1 ? [] : args.slice(explicitTargetSeparator + 1)

const chunk = <T>(items: readonly T[], size: number): T[][] => {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

// oxlint-disable-next-line kitz/domain/no-process-env
const env = process.env

const LINTABLE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.mts', '.cts'])

const listTrackedPaths = (prefix: string): string[] => {
  const result = spawnSync('git', ['ls-files', '--', prefix], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    env,
  })

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1)
  }

  return (result.stdout ?? '')
    .split('\n')
    .map((path) => path.trim())
    .filter((path) => path.length > 0)
}

const targets = explicitTargets.filter((target) => existsSync(join(repoRoot, target)))
const getDefaultTargetGroups = (): string[][] => {
  const trackedClaudeLintTargets = listTrackedPaths('.claude').filter((path) =>
    LINTABLE_EXTENSIONS.has(extname(path)),
  )

  return [trackedClaudeLintTargets, ['.github'], ['packages'], ['tools']].filter(
    (group) => group.length > 0,
  )
}
const targetGroups = explicitTargets.length > 0 ? chunk(targets, 50) : getDefaultTargetGroups()

for (const group of targetGroups) {
  if (group.length === 0) continue

  const result = spawnSync(oxlintBin, [...optionArgs, ...group], {
    cwd: repoRoot,
    stdio: 'inherit',
    env,
  })

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1)
  }
}

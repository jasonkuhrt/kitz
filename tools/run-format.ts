#!/usr/bin/env bun

// oxlint-disable-next-line kitz/no-nodejs-builtin-imports
import { spawnSync } from 'node:child_process'
// oxlint-disable-next-line kitz/no-nodejs-builtin-imports
import { extname, join } from 'node:path'

const repoRoot = process.cwd()
const oxfmtBin = join(repoRoot, 'node_modules', '.bin', 'oxfmt')
const args = process.argv.slice(2)
const mode = args.includes('--check') ? '--check' : '--write'
const explicitTargets = args.filter((arg) => arg !== '--check')
const MAX_EXPLICIT_TARGETS_PER_BATCH = 25
// oxlint-disable-next-line kitz/no-process-env-outside-config-modules
const env = process.env

const FORMATTABLE_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.mjs',
  '.cjs',
  '.mts',
  '.cts',
  '.json',
  '.md',
])

const listTrackedPaths = (prefix: string): string[] => {
  const result = spawnSync('git', ['ls-files', '--', prefix], {
    cwd: repoRoot,
    encoding: 'utf8',
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

const getDefaultGroups = (): string[][] => {
  const trackedClaudePaths = listTrackedPaths('.claude').filter((path) =>
    FORMATTABLE_EXTENSIONS.has(extname(path)),
  )
  const trackedSerenaPaths = listTrackedPaths('.serena').filter((path) =>
    FORMATTABLE_EXTENSIONS.has(extname(path)),
  )

  return [
    [...trackedClaudePaths, ...trackedSerenaPaths],
    [
      '.github',
      'README.md',
      'bun.lock',
      'package.json',
      '.oxfmtrc.json',
      '.oxlintrc.json',
      '.oxlintrc.custom-strict.json',
      '.oxlintrc.api-model-style.json',
      'tsconfig.build.json',
    ],
    ['docs'],
    ['packages'],
    ['tools'],
  ]
}

const chunk = <T>(items: readonly T[], size: number): T[][] => {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

const targetGroups =
  explicitTargets.length > 0
    ? chunk(explicitTargets, MAX_EXPLICIT_TARGETS_PER_BATCH)
    : getDefaultGroups()

for (const group of targetGroups) {
  if (group.length === 0) continue

  const command = [oxfmtBin, mode, ...group]
    .map((part) => `"${part.replaceAll('"', '\\"')}"`)
    .join(' ')

  const result = spawnSync('/bin/sh', ['-lc', command], {
    cwd: repoRoot,
    stdio: 'inherit',
    env,
  })

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1)
  }
}

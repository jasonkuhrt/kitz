#!/usr/bin/env bun

import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

const repoRoot = process.cwd()
const oxfmtBin = join(repoRoot, 'node_modules', '.bin', 'oxfmt')
const args = process.argv.slice(2)
const mode = args.includes('--check') ? '--check' : '--write'
const explicitTargets = args.filter((arg) => arg !== '--check')
const MAX_EXPLICIT_TARGETS_PER_BATCH = 25

const groups = [
  ['.claude', '.serena'],
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
] as const

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
    : groups.map((group) => [...group])

for (const group of targetGroups) {
  const command = [oxfmtBin, mode, ...group]
    .map((part) => `"${part.replaceAll('"', '\\"')}"`)
    .join(' ')

  const result = spawnSync('/bin/sh', ['-lc', command], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
  })

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1)
  }
}

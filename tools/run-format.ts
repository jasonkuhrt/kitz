#!/usr/bin/env bun

import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

const repoRoot = process.cwd()
const oxfmtBin = join(repoRoot, 'node_modules', '.bin', 'oxfmt')
const mode = process.argv.includes('--check') ? '--check' : '--write'

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

for (const group of groups) {
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

#!/usr/bin/env bun

// oxlint-disable-next-line kitz/module/no-nodejs-builtins
import { spawnSync } from 'node:child_process'
// oxlint-disable-next-line kitz/module/no-nodejs-builtins
import { existsSync, readdirSync, readFileSync } from 'node:fs'
// oxlint-disable-next-line kitz/module/no-nodejs-builtins
import { join } from 'node:path'
// oxlint-disable-next-line kitz/module/no-nodejs-builtins
import process from 'node:process'

// Workspace coverage runner.
//
// Bun's `bun test --coverage` uses JSC's native Inspector.Coverage agent —
// no node:inspector v8 dance required. This script just iterates each
// package and runs its `test:coverage` script if defined.

const repoRoot = process.cwd()
const packagesRoot = join(repoRoot, 'packages')

const getWorkspacePackageDirs = () =>
  readdirSync(packagesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(packagesRoot, entry.name))
    .filter((directory) => existsSync(join(directory, 'package.json')))
    .sort((left, right) => left.localeCompare(right))

for (const packageDir of getWorkspacePackageDirs()) {
  // oxlint-disable-next-line kitz/schema/no-json-parse
  const manifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'))
  const script = manifest.scripts?.['test:coverage']

  if (typeof script !== 'string' || script.trim() === '') continue

  console.log(`\n==> ${manifest.name ?? packageDir}`)

  const result = spawnSync('/bin/sh', ['-c', script], {
    cwd: packageDir,
    stdio: 'inherit',
  })

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1)
  }
}

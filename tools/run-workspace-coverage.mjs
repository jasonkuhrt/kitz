#!/usr/bin/env node

// oxlint-disable-next-line kitz/module/no-nodejs-builtins
import { spawnSync } from 'node:child_process'
// oxlint-disable-next-line kitz/module/no-nodejs-builtins
import { existsSync, readdirSync, readFileSync } from 'node:fs'
// oxlint-disable-next-line kitz/module/no-nodejs-builtins
import { dirname, join } from 'node:path'
// oxlint-disable-next-line kitz/module/no-nodejs-builtins
import process from 'node:process'

const repoRoot = process.cwd()
const packagesRoot = join(repoRoot, 'packages')
const rootBin = join(repoRoot, 'node_modules', '.bin')
// oxlint-disable-next-line kitz/domain/no-process-env
const env = process.env

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

  const packageBin = join(packageDir, 'node_modules', '.bin')
  const path = [packageBin, rootBin, env.PATH].filter(Boolean).join(':')

  console.log(`\n==> ${manifest.name ?? dirname(packageDir)}`)

  const result = spawnSync('/bin/sh', ['-lc', script], {
    cwd: packageDir,
    stdio: 'inherit',
    env: {
      ...env,
      PATH: path,
    },
  })

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1)
  }
}

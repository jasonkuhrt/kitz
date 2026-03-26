#!/usr/bin/env bun

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
const childEnv = { ...env }

for (const key of Object.keys(childEnv)) {
  if (key.startsWith('npm_')) {
    delete childEnv[key]
  }
}

delete childEnv.NODE
delete childEnv.BUN
delete childEnv.BUN_OPTIONS

const realNodePath = (() => {
  const lookup = spawnSync('/usr/bin/env', ['which', '-a', 'node'], {
    encoding: 'utf8',
    env: childEnv,
  })

  if ((lookup.status ?? 1) !== 0) {
    throw new Error('Could not resolve a Node executable for Vitest coverage')
  }

  const candidates = (lookup.stdout ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  for (const candidate of candidates) {
    const probe = spawnSync(
      candidate,
      [
        '-p',
        'JSON.stringify({ release: process.release.name, bun: process.versions.bun ?? null })',
      ],
      {
        encoding: 'utf8',
        env: childEnv,
      },
    )

    if ((probe.status ?? 1) !== 0) continue

    try {
      // oxlint-disable-next-line kitz/schema/no-json-parse
      const metadata = JSON.parse((probe.stdout ?? '').trim())
      if (metadata.release === 'node' && metadata.bun === null) {
        return candidate
      }
    } catch {
      continue
    }
  }

  throw new Error('Could not find a real Node runtime for Vitest coverage')
})()
const realNodeDir = dirname(realNodePath)

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
  const path = [realNodeDir, packageBin, rootBin, env.PATH].filter(Boolean).join(':')

  console.log(`\n==> ${manifest.name ?? dirname(packageDir)}`)

  const result = spawnSync('/bin/sh', ['-c', script], {
    cwd: packageDir,
    stdio: 'inherit',
    env: {
      ...childEnv,
      PATH: path,
    },
  })

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1)
  }
}

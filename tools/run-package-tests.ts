#!/usr/bin/env bun

// oxlint-disable-next-line kitz/module/no-nodejs-builtins
import { existsSync, readdirSync, readFileSync } from 'node:fs'
// oxlint-disable-next-line kitz/module/no-nodejs-builtins
import { join } from 'node:path'
// oxlint-disable-next-line kitz/domain/no-process-env
// oxlint-disable-next-line kitz/module/no-nodejs-builtins
import process from 'node:process'

const repoRoot = process.cwd()
const packagesRoot = join(repoRoot, 'packages')
// oxlint-disable-next-line kitz/domain/no-process-env
const env = process.env
const args = process.argv.slice(2)
const scriptName = args.find((arg) => !arg.startsWith('-')) ?? 'test'
const ifPresent = args.includes('--if-present')

type Manifest = {
  name?: string
  scripts?: Record<string, string>
}

const getWorkspacePackageDirs = () =>
  readdirSync(packagesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(packagesRoot, entry.name))
    .filter((directory) => existsSync(join(directory, 'package.json')))
    .sort((left, right) => left.localeCompare(right))

const readManifest = (packageDir: string): Manifest => {
  // oxlint-disable-next-line kitz/schema/no-json-parse
  return JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8')) as Manifest
}

for (const packageDir of getWorkspacePackageDirs()) {
  const manifest = readManifest(packageDir)
  const script = manifest.scripts?.[scriptName]
  const label = manifest.name ?? packageDir

  if (typeof script !== 'string' || script.trim() === '') {
    if (ifPresent) continue

    console.error(`Missing script '${scriptName}' in ${label}`)
    process.exit(1)
  }

  console.log(`\n==> ${label} ${scriptName}`)

  const proc = Bun.spawn([process.execPath, 'run', scriptName], {
    cwd: packageDir,
    stdout: 'inherit',
    stderr: 'inherit',
    env,
  })

  // oxlint-disable-next-line eslint/no-await-in-loop -- package tests must run sequentially to avoid shared terminal state and benchmark contention
  const exitCode = await proc.exited

  if (exitCode !== 0) {
    process.exit(exitCode)
  }
}

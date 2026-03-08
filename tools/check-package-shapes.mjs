#!/usr/bin/env bun

import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { rewriteRuntimeTargetsToBuild } from '../packages/pkg/src/manifest/runtime-targets.ts'

const packagesDir = join(process.cwd(), 'packages')
const packageJsonPaths = readdirSync(packagesDir)
  .map((name) => join(packagesDir, name, 'package.json'))
  .filter((path) => {
    try {
      readFileSync(path, 'utf8')
      return true
    } catch {
      return false
    }
  })

const originalContents = new Map(packageJsonPaths.map((path) => [path, readFileSync(path, 'utf8')]))

const rewriteManifest = (content) => {
  const manifest = JSON.parse(content)
  if (manifest.imports && typeof manifest.imports === 'object') {
    manifest.imports = rewriteRuntimeTargetsToBuild(manifest.imports)
  }
  if (manifest.exports && typeof manifest.exports === 'object') {
    manifest.exports = rewriteRuntimeTargetsToBuild(manifest.exports)
  }
  return JSON.stringify(manifest, null, 2) + '\n'
}

try {
  for (const [path, content] of originalContents) {
    writeFileSync(path, rewriteManifest(content))
  }

  const result = spawnSync('bun', ['run', '--workspaces', 'check:package'], {
    stdio: 'inherit',
    env: process.env,
  })
  process.exitCode = result.status ?? 1
} finally {
  for (const [path, content] of originalContents) {
    writeFileSync(path, content)
  }
}

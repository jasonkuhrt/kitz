#!/usr/bin/env bun

// oxlint-disable-next-line kitz/module/no-nodejs-builtins
import { existsSync, readdirSync, readFileSync } from 'node:fs'
// oxlint-disable-next-line kitz/module/no-nodejs-builtins
import { join } from 'node:path'
// oxlint-disable-next-line kitz/domain/no-process-env
// oxlint-disable-next-line kitz/module/no-nodejs-builtins
import process from 'node:process'

// Workspace coverage runner.
//
// Bun's `bun test --coverage` uses JSC's native Inspector.Coverage agent —
// no node:inspector v8 dance required. This script just iterates each
// package and runs its `test:coverage` script if defined.
//
// Uses Bun.spawn instead of node's spawnSync because the latter intermittently
// produces "WriteFailed" on bun 1.3.x when subprocess stdout is large
// (specifically, packages with many covered files like @kitz/tui or
// @kitz/release). Bun.spawn handles its own stdio without the cross-runtime
// pipe issue.

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

  // Capture stdout/stderr and write through to console.log/error after
  // process exit. Direct `inherit` sometimes produces a "WriteFailed"
  // internal error on bun 1.3.x when the subprocess produces a large
  // coverage report — likely a stdout-pipe buffering issue between the
  // parent (this script) and child (bun:test).
  const proc = Bun.spawn(['/bin/sh', '-c', script], {
    cwd: packageDir,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  // oxlint-disable-next-line eslint/no-await-in-loop -- sequential per-package coverage runs by design
  const [stdoutText, stderrText, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  if (stdoutText) process.stdout.write(stdoutText)
  if (stderrText) process.stderr.write(stderrText)

  if (exitCode !== 0) {
    process.exit(exitCode)
  }
}

#!/usr/bin/env bun

import { spawnSync } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'

const MAX_BUFFER = 16 * 1024 * 1024

const readPathsFromStdin = async () => {
  const chunks = []
  for await (const chunk of process.stdin) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8').split('\0').filter(Boolean)
}

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    env: process.env,
    maxBuffer: MAX_BUFFER,
    ...options,
  })

  if (result.status !== 0) {
    const detail =
      result.stderr || result.stdout || `Exited with status ${result.status ?? 'unknown'}`
    throw new Error(`${command} ${args.join(' ')} failed: ${detail.trim()}`)
  }

  return result.stdout
}

const runStatus = (command, args) =>
  spawnSync(command, args, {
    encoding: 'utf8',
    env: process.env,
    maxBuffer: MAX_BUFFER,
  }).status

const getIndexMode = (path) => {
  const line = run('git', ['ls-files', '--stage', '--', path]).split('\n').find(Boolean)

  if (!line) return null

  const match = /^(\d+) [0-9a-f]+ \d+\t/.exec(line)
  if (!match) {
    throw new Error(`Could not parse index entry for ${path}`)
  }

  return match[1]
}

const isIgnored = (path) =>
  path.startsWith('.claude/') ||
  path.startsWith('.serena/') ||
  path.includes('/__snapshots__/') ||
  path.startsWith('tools/oxlint-custom-rules/tests/fixtures/') ||
  path === 'packages/core/src/obj/diff.test-d.ts' ||
  path === 'packages/core/src/ts/simplify.test-d.ts'

const formatStagedBlob = (path, source) =>
  run('bunx', ['oxfmt', '--stdin-filepath', path], { input: source })

const updateIndex = (path, mode, contents) => {
  const blobId = run('git', ['hash-object', '-w', '--stdin'], { input: contents }).trim()
  run('git', ['update-index', '-z', '--index-info'], {
    input: `${mode} ${blobId}\t${path}\0`,
  })
}

const hasUnstagedChanges = (path) => {
  const diffStatus = runStatus('git', ['diff', '--quiet', '--', path])
  if (diffStatus === 0) return false
  if (diffStatus === 1) return true
  throw new Error(`Could not determine unstaged state for ${path}`)
}

const syncWorkingTreeIfSafe = (path, contents, hadUnstagedChanges) => {
  if (!hadUnstagedChanges && existsSync(path)) {
    writeFileSync(path, contents)
  }
}

const main = async () => {
  const paths = await readPathsFromStdin()

  for (const path of paths) {
    if (isIgnored(path)) continue

    const mode = getIndexMode(path)
    if (!mode) continue

    const staged = run('git', ['show', `:${path}`])
    const formatted = formatStagedBlob(path, staged)
    const unstagedChanges = hasUnstagedChanges(path)

    if (formatted === staged) continue

    updateIndex(path, mode, formatted)
    syncWorkingTreeIfSafe(path, formatted, unstagedChanges)
  }
}

await main()

#!/usr/bin/env bun

// oxlint-disable-next-line kitz/no-nodejs-builtin-imports
import { spawnSync } from 'node:child_process'
// oxlint-disable-next-line kitz/no-nodejs-builtin-imports
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
// oxlint-disable-next-line kitz/no-nodejs-builtin-imports
import { tmpdir } from 'node:os'
// oxlint-disable-next-line kitz/no-nodejs-builtin-imports
import { extname, join } from 'node:path'

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

const LINTABLE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.mts', '.cts'])

const MAX_BUFFER = 16 * 1024 * 1024
// oxlint-disable-next-line kitz/no-process-env-outside-config-modules
const env = process.env

interface CommandResult {
  readonly status: number
  readonly stdout: string
  readonly stderr: string
}

const run = (
  command: string,
  args: readonly string[],
  options: { readonly cwd?: string; readonly input?: Buffer | string } = {},
): CommandResult => {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    input: options.input,
    encoding: 'utf8',
    env,
    maxBuffer: MAX_BUFFER,
  })

  return {
    status: result.status ?? (result.error ? 1 : 0),
    stdout: result.stdout ?? '',
    stderr: result.error?.message
      ? `${result.stderr ?? ''}${result.error.message}`
      : (result.stderr ?? ''),
  }
}

const runOrThrow = (
  command: string,
  args: readonly string[],
  options: { readonly cwd?: string; readonly input?: Buffer | string } = {},
): string => {
  const result = run(command, args, options)
  if (result.status !== 0) {
    const detail = result.stderr || result.stdout || `${command} ${args.join(' ')} failed`
    throw new Error(detail.trim())
  }

  return result.stdout
}

const runBufferOrThrow = (
  command: string,
  args: readonly string[],
  options: { readonly cwd?: string; readonly input?: Buffer | string } = {},
): Buffer => {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    input: options.input,
    env,
    maxBuffer: MAX_BUFFER,
  })

  if (result.status !== 0) {
    const detail =
      result.stderr?.toString('utf8') ||
      result.stdout?.toString('utf8') ||
      `${command} ${args.join(' ')} failed`
    throw new Error(detail.trim())
  }

  return Buffer.from(result.stdout)
}

const repoRoot = runOrThrow('git', ['rev-parse', '--show-toplevel']).trim()

const lintArgs = ['--import-plugin', '--deny-warnings']
const lintFixArgs = [...lintArgs, '--fix-dangerously']

const listStagedPaths = (): readonly string[] =>
  runOrThrow('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
    cwd: repoRoot,
  })
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

const getIndexMode = (path: string): string | null => {
  const line = runOrThrow('git', ['ls-files', '--stage', '--', path], { cwd: repoRoot })
    .split('\n')
    .find(Boolean)

  if (!line) return null

  const match = /^(\d+) [0-9a-f]+ \d+\t/.exec(line)
  if (!match) {
    throw new Error(`Could not parse index entry for ${path}`)
  }

  return match[1] ?? null
}

const hasUnstagedChanges = (path: string): boolean => {
  const result = run('git', ['diff', '--quiet', '--', path], { cwd: repoRoot })
  if (result.status === 0) return false
  if (result.status === 1) return true
  throw new Error(`Could not determine unstaged state for ${path}`)
}

const updateIndex = (path: string, mode: string, contents: Buffer): void => {
  const blobId = runOrThrow('git', ['hash-object', '-w', '--stdin'], {
    cwd: repoRoot,
    input: contents,
  }).trim()

  const update = spawnSync('git', ['update-index', '-z', '--index-info'], {
    cwd: repoRoot,
    input: Buffer.from(`${mode} ${blobId}\t${path}\0`, 'utf8'),
    env,
    maxBuffer: MAX_BUFFER,
  })

  if ((update.status ?? 1) !== 0) {
    const detail =
      update.stderr?.toString('utf8') ||
      update.stdout?.toString('utf8') ||
      `git update-index failed for ${path}`
    throw new Error(detail.trim())
  }
}

const syncWorkingTreeIfSafe = (
  path: string,
  contents: Buffer,
  hadUnstagedChanges: boolean,
): void => {
  const absolutePath = join(repoRoot, path)
  if (hadUnstagedChanges || !existsSync(absolutePath)) {
    return
  }

  writeFileSync(absolutePath, contents)
}

const isFormattable = (path: string): boolean => FORMATTABLE_EXTENSIONS.has(extname(path))
const isLintable = (path: string): boolean => LINTABLE_EXTENSIONS.has(extname(path))

const runFormat = (
  snapshotRoot: string,
  paths: readonly string[],
  mode: '--write' | '--check',
): CommandResult => {
  return run('bun', ['tools/run-format.ts', mode, ...paths], { cwd: snapshotRoot })
}

const runLint = (
  snapshotRoot: string,
  paths: readonly string[],
  args: readonly string[],
): CommandResult => {
  return run('bun', ['tools/run-lint.ts', ...args, '--', ...paths], { cwd: snapshotRoot })
}

const materializeIndexSnapshot = (): string => {
  const tempDir = mkdtempSync(join(tmpdir(), 'kitz-pre-commit-'))
  const prefix = tempDir.endsWith('/') ? tempDir : `${tempDir}/`
  runOrThrow('git', ['checkout-index', '--all', `--prefix=${prefix}`], { cwd: repoRoot })
  const nodeModulesPath = join(repoRoot, 'node_modules')
  if (existsSync(nodeModulesPath)) {
    symlinkSync(nodeModulesPath, join(tempDir, 'node_modules'))
  }
  return tempDir
}

const syncSnapshotBackToIndex = (snapshotRoot: string, paths: readonly string[]): void => {
  for (const path of paths) {
    const mode = getIndexMode(path)
    if (!mode) continue

    const snapshotPath = join(snapshotRoot, path)
    if (!existsSync(snapshotPath)) continue

    const next = readFileSync(snapshotPath)
    const previous = runBufferOrThrow('git', ['show', `:${path}`], { cwd: repoRoot })

    if (Buffer.compare(next, previous) === 0) continue

    const hadUnstagedChanges = hasUnstagedChanges(path)
    updateIndex(path, mode, next)
    syncWorkingTreeIfSafe(path, next, hadUnstagedChanges)
  }
}

const logFailure = (label: string, result: CommandResult): void => {
  console.error(`${label} failed.`)
  if (result.stdout.trim()) console.error(result.stdout.trim())
  if (result.stderr.trim()) console.error(result.stderr.trim())
}

const main = (): void => {
  const stagedPaths = listStagedPaths()
  if (stagedPaths.length === 0) return

  const formattablePaths = stagedPaths.filter(isFormattable)
  const lintablePaths = stagedPaths.filter(isLintable)
  const managedPaths = [...new Set([...formattablePaths, ...lintablePaths])]
  if (managedPaths.length === 0) return

  const snapshotRoot = materializeIndexSnapshot()

  try {
    if (formattablePaths.length > 0) {
      runFormat(snapshotRoot, formattablePaths, '--write')
    }

    if (lintablePaths.length > 0) {
      runLint(snapshotRoot, lintablePaths, lintFixArgs)
    }

    if (formattablePaths.length > 0) {
      runFormat(snapshotRoot, formattablePaths, '--write')
    }

    syncSnapshotBackToIndex(snapshotRoot, managedPaths)

    if (formattablePaths.length > 0) {
      const formatCheck = runFormat(snapshotRoot, formattablePaths, '--check')
      if (formatCheck.status !== 0) {
        logFailure('Formatting check', formatCheck)
        process.exit(1)
      }
    }

    if (lintablePaths.length > 0) {
      const lintCheck = runLint(snapshotRoot, lintablePaths, lintArgs)
      if (lintCheck.status !== 0) {
        logFailure('Lint check', lintCheck)
        process.exit(1)
      }
    }
  } finally {
    rmSync(snapshotRoot, { recursive: true, force: true })
  }
}

main()

#!/usr/bin/env bun

// oxlint-disable-next-line kitz/module/no-nodejs-builtins
import { spawnSync } from 'node:child_process'
// oxlint-disable-next-line kitz/module/no-nodejs-builtins
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
// oxlint-disable-next-line kitz/module/no-nodejs-builtins
import { tmpdir } from 'node:os'
// oxlint-disable-next-line kitz/module/no-nodejs-builtins
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
const TYPECHECKABLE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts'])
const SHELLCHECKABLE_EXTENSIONS = new Set(['.sh'])
const VALID_HOOK_SHEBANGS = new Set(['#!/usr/bin/env sh', '#!/usr/bin/env bash'])
const LOCAL_ARTIFACT_PREFIXES = [
  '.playwright-mcp/',
  '.serena/cache/',
  '.claude/worktrees/',
  '.worktrees/',
  '.release/',
] as const
const WORKFLOW_PATH_PATTERN = /^\.github\/workflows\/.+\.(yml|yaml)$/
const TSCONFIG_PATTERN = /^tsconfig(?:\..+)?\.json$/
const CLAUDE_LOCAL_CONTEXT_PATTERN = /^\.claude\/[^/]+\.local\.md$/

const MAX_BUFFER = 16 * 1024 * 1024
// oxlint-disable-next-line kitz/domain/no-process-env
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
const basename = (path: string): string => path.split('/').at(-1) ?? path

const isTypecheckRelevant = (path: string): boolean => {
  if (TYPECHECKABLE_EXTENSIONS.has(extname(path))) return true

  const file = basename(path)
  return file === 'package.json' || TSCONFIG_PATTERN.test(file)
}

const isWorkflowPath = (path: string): boolean => WORKFLOW_PATH_PATTERN.test(path)
const isHookPath = (path: string): boolean => path.startsWith('hooks/')
const isShellcheckable = (path: string): boolean =>
  SHELLCHECKABLE_EXTENSIONS.has(extname(path)) || isHookPath(path)

const isBlockedLocalArtifact = (path: string): boolean => {
  if (basename(path) === '.DS_Store') return true
  if (path === 'CLAUDE.local.md') return true
  if (CLAUDE_LOCAL_CONTEXT_PATTERN.test(path)) return true
  return LOCAL_ARTIFACT_PREFIXES.some((prefix) => path.startsWith(prefix))
}

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

const runCoverageInSnapshot = (snapshotRoot: string): CommandResult =>
  run('bun', ['run', 'check:cov:packages'], { cwd: snapshotRoot })

const runTypecheck = (snapshotRoot: string): CommandResult =>
  run('bun', ['run', 'check:types'], { cwd: snapshotRoot })

const runShellcheck = (snapshotRoot: string, paths: readonly string[]): CommandResult =>
  run('shellcheck', [...paths], { cwd: snapshotRoot })

const runActionlint = (snapshotRoot: string, paths: readonly string[]): CommandResult =>
  run('bun', ['run', 'check:ci', '--', ...paths], { cwd: snapshotRoot })

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

const fail = (message: string): never => {
  console.error(message)
  process.exit(1)
}

const assertNoBlockedLocalArtifacts = (stagedPaths: readonly string[]): void => {
  const blockedPaths = stagedPaths.filter(isBlockedLocalArtifact)

  if (blockedPaths.length === 0) return

  fail(
    [
      'Refusing to commit local-only artifacts:',
      ...blockedPaths.map((path) => `  ${path}`),
      'Unstage or remove these files before committing.',
    ].join('\n'),
  )
}

const assertNoConflictMarkers = (): void => {
  const result = run(
    'git',
    [
      'grep',
      '--cached',
      '-n',
      '-I',
      '-e',
      '^<<<<<<< ',
      '-e',
      '^=======$',
      '-e',
      '^>>>>>>> ',
      '--',
      '.',
    ],
    { cwd: repoRoot },
  )

  if (result.status === 1) return
  if (result.status > 1) {
    fail('Failed to scan the staged index for conflict markers.')
  }

  fail(`Refusing to commit conflict markers:\n${result.stdout.trim()}`)
}

const assertHookScriptsAreValid = (hookPaths: readonly string[]): void => {
  if (hookPaths.length === 0) return

  const failures: string[] = []

  for (const path of hookPaths) {
    const mode = getIndexMode(path)
    if (mode !== '100755') {
      failures.push(`${path} must be committed with mode 100755 (found ${mode ?? '<missing>'})`)
    }

    const firstLine = runOrThrow('git', ['show', `:${path}`], { cwd: repoRoot })
      .split(/\r?\n/u, 1)
      .at(0)

    if (!firstLine || !VALID_HOOK_SHEBANGS.has(firstLine)) {
      failures.push(`${path} must start with ${[...VALID_HOOK_SHEBANGS].join(' or ')}`)
    }
  }

  if (failures.length === 0) return

  fail(
    ['Refusing to commit invalid hook scripts:', ...failures.map((entry) => `  ${entry}`)].join(
      '\n',
    ),
  )
}

const main = (): void => {
  const stagedPaths = listStagedPaths()
  if (stagedPaths.length === 0) return

  const formattablePaths = stagedPaths.filter(isFormattable)
  const lintablePaths = stagedPaths.filter(isLintable)
  const typecheckRelevantPaths = stagedPaths.filter(isTypecheckRelevant)
  const shellcheckPaths = stagedPaths.filter(isShellcheckable)
  const workflowPaths = stagedPaths.filter(isWorkflowPath)
  const hookPaths = stagedPaths.filter(isHookPath)
  const managedPaths = [...new Set([...formattablePaths, ...lintablePaths])]

  assertNoBlockedLocalArtifacts(stagedPaths)
  assertNoConflictMarkers()
  assertHookScriptsAreValid(hookPaths)

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

    if (shellcheckPaths.length > 0) {
      const shellcheck = runShellcheck(snapshotRoot, shellcheckPaths)
      if (shellcheck.status !== 0) {
        logFailure('Shellcheck', shellcheck)
        process.exit(1)
      }
    }

    if (workflowPaths.length > 0) {
      const actionlint = runActionlint(snapshotRoot, workflowPaths)
      if (actionlint.status !== 0) {
        logFailure('Workflow lint', actionlint)
        process.exit(1)
      }
    }

    if (typecheckRelevantPaths.length > 0) {
      const typecheck = runTypecheck(snapshotRoot)
      if (typecheck.status !== 0) {
        logFailure('Type check', typecheck)
        process.exit(1)
      }
    }

    const coverageCheck = runCoverageInSnapshot(snapshotRoot)
    if (coverageCheck.status !== 0) {
      logFailure('Coverage check', coverageCheck)
      process.exit(1)
    }
  } finally {
    rmSync(snapshotRoot, { recursive: true, force: true })
  }
}

main()

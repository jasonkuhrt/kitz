#!/usr/bin/env bun

// oxlint-disable-next-line kitz/no-nodejs-builtin-imports
import { spawnSync } from 'node:child_process'
// oxlint-disable-next-line kitz/no-nodejs-builtin-imports
import { Dirent, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
// oxlint-disable-next-line kitz/no-nodejs-builtin-imports
import { extname, join } from 'node:path'

const repoRoot = process.cwd()
const oxfmtBin = join(repoRoot, 'node_modules', '.bin', 'oxfmt')
const args = process.argv.slice(2)
const mode = args.includes('--check') ? '--check' : '--write'
const explicitTargets = args.filter((arg) => arg !== '--check')
const MAX_PATH_MODE_TARGETS_PER_BATCH = 50
// oxlint-disable-next-line kitz/no-process-env-outside-config-modules
const env = process.env

const PATH_MODE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.mts', '.cts'])

const STDIN_MODE_EXTENSIONS = new Set(['.json', '.md', '.yaml', '.yml'])

const DEFAULT_TARGETS = [
  '.claude',
  '.serena',
  '.github',
  'README.md',
  'package.json',
  '.oxfmtrc.json',
  '.oxlintrc.json',
  '.oxlintrc.custom-strict.json',
  '.oxlintrc.api-model-style.json',
  'tsconfig.build.json',
  'docs',
  'packages',
  'tools',
] as const

const IGNORED_PATH_PREFIXES = ['tools/oxlint-custom-rules/tests/fixtures/'] as const
const IGNORED_PATHS = [] as const

const chunk = <T>(items: readonly T[], size: number): T[][] => {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

const normalizePath = (path: string): string => path.replaceAll('\\', '/')
const isIgnoredPath = (path: string): boolean =>
  IGNORED_PATHS.includes(path) ||
  IGNORED_PATH_PREFIXES.some((prefix) => path.startsWith(prefix)) ||
  path.startsWith('.claude/') ||
  path.startsWith('.serena/')

const isPathModeFile = (path: string): boolean => PATH_MODE_EXTENSIONS.has(extname(path))
const isStdinModeFile = (path: string): boolean => STDIN_MODE_EXTENSIONS.has(extname(path))
const isFormattableFile = (path: string): boolean =>
  !isIgnoredPath(path) && (isPathModeFile(path) || isStdinModeFile(path))

const isGitRepo = (): boolean => {
  const result = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], {
    cwd: repoRoot,
    stdio: 'ignore',
    env,
  })

  return (result.status ?? 1) === 0
}

const listTrackedPaths = (prefix: string): string[] => {
  const result = spawnSync('git', ['ls-files', '--', prefix], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    env,
  })

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1)
  }

  return (result.stdout ?? '')
    .split('\n')
    .map((path) => normalizePath(path.trim()))
    .filter((path) => path.length > 0)
}

const walkDirectory = (directory: string): string[] => {
  const absoluteDirectory = join(repoRoot, directory)
  const entries = readdirSync(absoluteDirectory, { withFileTypes: true })

  const files: string[] = []

  for (const entry of entries) {
    files.push(...walkEntry(directory, entry))
  }

  return files
}

const walkEntry = (parent: string, entry: Dirent): string[] => {
  const relativePath = normalizePath(join(parent, entry.name))

  if (entry.isDirectory()) {
    return walkDirectory(relativePath)
  }

  return [relativePath]
}

const expandTarget = (target: string, useTrackedPaths: boolean): string[] => {
  const absoluteTarget = join(repoRoot, target)
  if (!existsSync(absoluteTarget)) return []

  const stats = statSync(absoluteTarget)
  if (stats.isFile()) {
    return isFormattableFile(target) ? [normalizePath(target)] : []
  }

  if (!stats.isDirectory()) return []

  const paths = useTrackedPaths ? listTrackedPaths(target) : walkDirectory(target)
  return paths.filter(isFormattableFile)
}

const getTargetFiles = (): string[] => {
  const useTrackedPaths = isGitRepo()
  const targets = explicitTargets.length > 0 ? explicitTargets : [...DEFAULT_TARGETS]
  const files = targets.flatMap((target) => expandTarget(target, useTrackedPaths))
  return [...new Set(files)]
}

const runPathMode = (paths: readonly string[]): void => {
  for (const group of chunk(paths, MAX_PATH_MODE_TARGETS_PER_BATCH)) {
    if (group.length === 0) continue

    const result = spawnSync(oxfmtBin, ['--threads=1', mode, ...group], {
      cwd: repoRoot,
      stdio: 'inherit',
      env,
    })

    if ((result.status ?? 1) !== 0) {
      process.exit(result.status ?? 1)
    }
  }
}

const shellQuote = (value: string): string => `"${value.replaceAll('"', '\\"')}"`

const formatViaStdin = (path: string): Buffer => {
  const quotedFile = shellQuote(path)
  const quotedBin = shellQuote(oxfmtBin)
  const command = `${quotedBin} --stdin-filepath ${quotedFile} < ${quotedFile}`

  const result = spawnSync('/bin/sh', ['-lc', command], {
    cwd: repoRoot,
    env,
    maxBuffer: 16 * 1024 * 1024,
  })

  if ((result.status ?? 1) !== 0) {
    const detail =
      result.stderr?.toString('utf8') ||
      result.stdout?.toString('utf8') ||
      `oxfmt failed for ${path}`
    console.error(detail.trim())
    process.exit(result.status ?? 1)
  }

  return Buffer.from(result.stdout)
}

const runStdinMode = (paths: readonly string[]): void => {
  let hasDiff = false

  for (const path of paths) {
    const absolutePath = join(repoRoot, path)
    const source = readFileSync(absolutePath)
    const formatted = formatViaStdin(path)

    if (mode === '--write') {
      if (Buffer.compare(source, formatted) !== 0) {
        writeFileSync(absolutePath, formatted)
      }
      continue
    }

    if (Buffer.compare(source, formatted) !== 0) {
      hasDiff = true
      console.error(`File needs formatting: ${path}`)
    }
  }

  if (hasDiff) {
    process.exit(1)
  }
}

const targetFiles = getTargetFiles()
if (targetFiles.length === 0) process.exit(0)

const pathModeTargets = targetFiles.filter(isPathModeFile)
const stdinModeTargets = targetFiles.filter(isStdinModeFile)

runPathMode(pathModeTargets)
runStdinMode(stdinModeTargets)

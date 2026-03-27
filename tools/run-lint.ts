#!/usr/bin/env bun

// oxlint-disable-next-line kitz/module/no-nodejs-builtins
import { existsSync } from 'node:fs'
// oxlint-disable-next-line kitz/module/no-nodejs-builtins
import { extname, join, relative, resolve } from 'node:path'
// oxlint-disable-next-line kitz/module/no-nodejs-builtins
import { spawnSync } from 'node:child_process'

const chunk = <T>(items: readonly T[], size: number): T[][] => {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

// oxlint-disable-next-line kitz/domain/no-process-env
const env = process.env
const invocationCwd = process.cwd()

const runGit = (gitArgs: string[]) =>
  spawnSync('git', gitArgs, {
    cwd: invocationCwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    env,
  })

const repoRootResult = runGit(['rev-parse', '--show-toplevel'])

if ((repoRootResult.status ?? 1) !== 0) {
  process.exit(repoRootResult.status ?? 1)
}

const repoRoot = repoRootResult.stdout.trim()
const oxlintBin = join(repoRoot, 'node_modules', '.bin', 'oxlint')
const args = process.argv.slice(2)
const explicitTargetSeparator = args.indexOf('--')
const argsBeforeSeparator =
  explicitTargetSeparator === -1 ? args : args.slice(0, explicitTargetSeparator)
const argsAfterSeparator =
  explicitTargetSeparator === -1 ? [] : args.slice(explicitTargetSeparator + 1)
const optionArgs: string[] = []
const explicitTargets: string[] = [...argsAfterSeparator]
const optionArgsWithValues = new Set(['--config', '-c', '--import-plugin'])

for (let index = 0; index < argsBeforeSeparator.length; index += 1) {
  const arg = argsBeforeSeparator[index]

  if (optionArgsWithValues.has(arg)) {
    optionArgs.push(arg)
    index += 1

    if (index < argsBeforeSeparator.length) {
      const optionValue = argsBeforeSeparator[index]

      if (optionValue !== undefined) {
        optionArgs.push(
          arg === '--config' || arg === '-c' ? resolve(invocationCwd, optionValue) : optionValue,
        )
      }
    }

    continue
  }

  if (arg.startsWith('-')) {
    optionArgs.push(arg)
    continue
  }

  explicitTargets.push(arg)
}

const LINTABLE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.mts', '.cts'])

const listTrackedPaths = (prefix: string): string[] => {
  const result = runGit(['ls-files', '--', prefix])

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1)
  }

  return (result.stdout ?? '')
    .split('\n')
    .map((path) => path.trim())
    .filter((path) => path.length > 0)
}

const toRepoRelativeTarget = (target: string): string => {
  const absoluteTarget = resolve(invocationCwd, target)

  if (!existsSync(absoluteTarget)) {
    return ''
  }

  return relative(repoRoot, absoluteTarget)
}

const targets = explicitTargets.map(toRepoRelativeTarget).filter((target) => target.length > 0)
const getDefaultTargetGroups = (): string[][] => {
  const trackedClaudeLintTargets = listTrackedPaths('.claude').filter((path) =>
    LINTABLE_EXTENSIONS.has(extname(path)),
  )

  return [trackedClaudeLintTargets, ['.github'], ['packages'], ['tools']].filter(
    (group) => group.length > 0,
  )
}
const targetGroups = explicitTargets.length > 0 ? chunk(targets, 50) : getDefaultTargetGroups()
const oxlintWarningBannerLines = new Set([
  'WARNING: JS plugins are experimental and not subject to semver.',
  'Breaking changes are possible while JS plugins support is under development.',
])

const filterOxlintBanner = (output: string | null | undefined): string =>
  (output ?? '')
    .split('\n')
    .filter((line) => !oxlintWarningBannerLines.has(line.trim()))
    .join('\n')

for (const group of targetGroups) {
  if (group.length === 0) continue

  // Always pass explicit config to avoid auto-discovery issues with JS plugin resolution
  const hasConfig = optionArgs.some((arg) => arg === '--config' || arg === '-c')
  const configArgs = hasConfig ? [] : ['--config', join(repoRoot, '.oxlintrc.json')]

  const result = spawnSync(oxlintBin, [...configArgs, ...optionArgs, ...group], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env,
  })

  const stdout = filterOxlintBanner(result.stdout)
  const stderr = filterOxlintBanner(result.stderr)

  if (stdout.length > 0) {
    process.stdout.write(stdout)
  }

  if (stderr.length > 0) {
    process.stderr.write(stderr)
  }

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1)
  }
}

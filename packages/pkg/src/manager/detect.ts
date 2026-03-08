import { FileSystem } from '@effect/platform'
import type { PlatformError } from '@effect/platform/Error'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Resource } from '@kitz/resource'
import { Effect, Option } from 'effect'
import { Manifest } from '#manifest'
import { DetectedPackageManager, type PackageManager } from './PackageManager.js'

type DetectError = PlatformError | Resource.ResourceError

const packageJsonRelFile = Fs.Path.RelFile.fromString('./package.json')

const lockfileToManager: ReadonlyArray<readonly [string, PackageManager]> = [
  ['bun.lock', 'bun'],
  ['bun.lockb', 'bun'],
  ['pnpm-lock.yaml', 'pnpm'],
  ['package-lock.json', 'npm'],
  ['yarn.lock', 'yarn'],
]

const parsePackageManagerName = (value: string | undefined): Option.Option<PackageManager> => {
  if (!value) return Option.none()
  const normalized = value.trim().toLowerCase()
  const name = normalized.split('@', 1)[0]

  switch (name) {
    case 'bun':
    case 'pnpm':
    case 'npm':
    case 'yarn':
      return Option.some(name)
    default:
      return Option.none()
  }
}

const parseUserAgent = (value: string | undefined): Option.Option<PackageManager> => {
  if (!value) return Option.none()
  const head = value.trim().split(/\s+/, 1)[0]?.split('/', 1)[0]
  return parsePackageManagerName(head)
}

const parseExecPath = (value: string | undefined): Option.Option<PackageManager> => {
  if (!value) return Option.none()
  const normalized = value.toLowerCase()
  if (normalized.includes('bun')) return Option.some('bun')
  if (normalized.includes('pnpm')) return Option.some('pnpm')
  if (normalized.includes('yarn')) return Option.some('yarn')
  if (normalized.includes('npm')) return Option.some('npm')
  return Option.none()
}

const detectFromEnvironment = Effect.gen(function* () {
  const env = yield* Env.Env

  const byUserAgent = parseUserAgent(env.vars['npm_config_user_agent'])
  if (Option.isSome(byUserAgent)) {
    return Option.some(
      DetectedPackageManager.make({
        name: byUserAgent.value,
        source: 'user-agent',
      }),
    )
  }

  const byExecPath = parseExecPath(env.vars['npm_execpath'])
  if (Option.isSome(byExecPath)) {
    return Option.some(
      DetectedPackageManager.make({
        name: byExecPath.value,
        source: 'exec-path',
      }),
    )
  }

  return Option.none<DetectedPackageManager>()
})

const locateFromManifestOrLockfile = (
  startDir: Fs.Path.AbsDir,
): Effect.Effect<Option.Option<DetectedPackageManager>, DetectError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    let current = startDir

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (true) {
      const manifest = yield* Manifest.resource.read(current)
      if (Option.isSome(manifest)) {
        const manifestManager = parsePackageManagerName(manifest.value.packageManager)
        if (Option.isSome(manifestManager)) {
          return Option.some(
            DetectedPackageManager.make({
              name: manifestManager.value,
              source: 'manifest',
            }),
          )
        }
      }

      for (const [filename, manager] of lockfileToManager) {
        const lockfile = Fs.Path.join(current, Fs.Path.RelFile.fromString(`./${filename}`))
        const exists = yield* fs.exists(Fs.Path.toString(lockfile))
        if (exists) {
          return Option.some(
            DetectedPackageManager.make({
              name: manager,
              source: 'lockfile',
            }),
          )
        }
      }

      const packageJsonPath = Fs.Path.join(current, packageJsonRelFile)
      const packageJsonExists = yield* fs.exists(Fs.Path.toString(packageJsonPath))
      if (packageJsonExists) {
        const parent = Fs.Path.up(current)
        if (parent === null) break
        current = parent
        continue
      }

      const parent = Fs.Path.up(current)
      if (parent === null) break
      current = parent
    }

    return Option.none()
  })

/**
 * Detect the active package manager from runtime environment, package.json,
 * and common lockfiles.
 */
export const detect = (options?: {
  readonly startDir?: Fs.Path.AbsDir
}): Effect.Effect<DetectedPackageManager, DetectError, FileSystem.FileSystem | Env.Env> =>
  Effect.gen(function* () {
    const env = yield* Env.Env

    const fromEnvironment = yield* detectFromEnvironment
    if (Option.isSome(fromEnvironment)) return fromEnvironment.value

    const fromProject = yield* locateFromManifestOrLockfile(options?.startDir ?? env.cwd)
    if (Option.isSome(fromProject)) return fromProject.value

    if (env.platform === 'bun') {
      return DetectedPackageManager.make({
        name: 'bun',
        source: 'runtime',
      })
    }

    return DetectedPackageManager.make({
      name: 'unknown',
      source: 'unknown',
    })
  })

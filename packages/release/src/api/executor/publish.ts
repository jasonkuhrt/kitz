import { FileSystem } from '@effect/platform'
import type { PlatformError } from '@effect/platform/Error'
import { Err } from '@kitz/core'
import { Fs } from '@kitz/fs'
import { NpmRegistry } from '@kitz/npm-registry'
import { Pkg } from '@kitz/pkg'
import { Resource } from '@kitz/resource'
import { Semver } from '@kitz/semver'
import { Effect, Either, Schema as S } from 'effect'
import type { Package } from '../analyzer/workspace.js'

const baseTags = ['kit', 'release', 'publish'] as const
const PublishErrorContext = S.Struct({
  package: Fs.Path.AbsDir.Schema,
  detail: S.optional(S.String),
})
const JsonRecordSchema = S.Record({ key: S.String, value: S.Unknown })
const JsonRecordFromStringSchema = S.parseJson(JsonRecordSchema)
const decodeJsonRecord = S.decodeUnknown(JsonRecordFromStringSchema)
const publishHookNames = [
  'prepack',
  'postpack',
  'prepublish',
  'prepublishOnly',
  'publish',
  'postpublish',
] as const

/**
 * Minimal release info needed for publishing.
 */
export interface ReleaseInfo {
  readonly package: Package
  readonly nextVersion: Semver.Semver
}

/**
 * Error during publish process.
 */
export const PublishError: Err.TaggedContextualErrorClass<
  'PublishError',
  typeof baseTags,
  typeof PublishErrorContext,
  undefined
> = Err.TaggedContextualError('PublishError', baseTags, {
  context: PublishErrorContext,
  message: (ctx) =>
    `Failed to publish package at ${Fs.Path.toString(ctx.package)}` +
    (ctx.detail ? `: ${ctx.detail}` : ''),
})

export type PublishError = InstanceType<typeof PublishError>

/**
 * Options for publishing.
 */
export interface PublishOptions {
  /** npm dist-tag (default: 'latest') */
  readonly tag?: string
  /** Registry URL */
  readonly registry?: string
}

const formatUnknownError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

const findPublishHooks = (manifest: Pkg.Manifest.Manifest): readonly string[] => {
  const scripts = manifest.scripts ?? {}
  return publishHookNames.filter((name) => name in scripts)
}

const renderHookDisclaimer = (hooks: readonly string[]): string | undefined =>
  hooks.length === 0
    ? undefined
    : `Publish hooks detected (${hooks.join(', ')}). Release cannot prove whether those scripts left additional cleanup behind.`

const renderCleanupReminder = (): string =>
  'Re-run `release doctor --onlyRule plan.packages-runtime-targets-source-oriented` before retrying.'

const renderPublishFailureDetail = (params: {
  readonly publishError: unknown
  readonly cleanupFailureDetail?: string
  readonly publishHooks: readonly string[]
}): string =>
  [
    formatUnknownError(params.publishError),
    params.cleanupFailureDetail === undefined
      ? 'Manifest cleanup restored version and runtime targets.'
      : `Manifest cleanup failed: ${params.cleanupFailureDetail}. Inspect package.json runtime targets before retrying.`,
    renderHookDisclaimer(params.publishHooks),
    renderCleanupReminder(),
  ]
    .filter((part) => part !== undefined)
    .join(' ')

const renderCleanupFailureDetail = (params: {
  readonly cleanupError: unknown
  readonly publishHooks: readonly string[]
}): string =>
  [
    `Package was published, but manifest cleanup failed: ${formatUnknownError(params.cleanupError)}.`,
    'Inspect package.json and restore runtime targets under `imports` and `exports` back to `./src/*.ts` before continuing.',
    renderHookDisclaimer(params.publishHooks),
    renderCleanupReminder(),
  ]
    .filter((part) => part !== undefined)
    .join(' ')

/**
 * Publish a single package with version injection and restoration.
 *
 * Rewrites package.json `imports` and `exports` from source paths (`./src/*.ts`)
 * to build paths (`./build/*.js`) before publishing, then restores originals.
 *
 * Requires `NpmRegistry.NpmCli` service - provide `NpmRegistry.NpmCliLive`
 * for actual publishing or `NpmRegistry.NpmCliDryRun` for dry-run mode.
 */
export const publishPackage = (
  release: ReleaseInfo,
  options?: PublishOptions,
): Effect.Effect<
  void,
  PublishError | Resource.ResourceError | PlatformError,
  FileSystem.FileSystem | NpmRegistry.NpmCli
> =>
  Effect.gen(function* () {
    const remakeManifestWithVersion = (
      manifest: Pkg.Manifest.Manifest,
      version: Pkg.Manifest.Manifest[`version`],
    ): Pkg.Manifest.Manifest => Pkg.Manifest.Manifest.make(Object.assign({}, manifest, { version }))
    const decodeJsonRecordOrFail = (json: string) =>
      decodeJsonRecord(json).pipe(
        Effect.mapError(
          () =>
            new PublishError({
              context: { package: release.package.path },
            }),
        ),
      )

    const pkgDir = release.package.path
    const cli = yield* NpmRegistry.NpmCli
    const fs = yield* FileSystem.FileSystem

    // 1. Read raw package.json to access the imports field
    const packageJsonPath = `${Fs.Path.toString(pkgDir)}package.json`
    const rawJson = yield* fs.readFileString(packageJsonPath)
    const rawPkg = yield* decodeJsonRecordOrFail(rawJson)
    const originalImports = rawPkg['imports'] as Record<string, unknown> | undefined
    const originalExports = rawPkg['exports'] as Record<string, unknown> | undefined

    // 2. Inject the new version, capturing original for restore
    const manifest = yield* Pkg.Manifest.resource.readOrEmpty(pkgDir)
    const publishHooks = findPublishHooks(manifest)
    const originalVersion = manifest.version
    yield* Pkg.Manifest.resource.write(
      remakeManifestWithVersion(manifest, release.nextVersion),
      pkgDir,
    )

    // 3. Rewrite imports/exports for publish (source paths -> build paths)
    if (originalImports || originalExports) {
      const rewrittenJson = yield* fs.readFileString(packageJsonPath)
      const rewrittenPkg = { ...(yield* decodeJsonRecordOrFail(rewrittenJson)) }
      if (originalImports) {
        rewrittenPkg['imports'] = Pkg.Manifest.rewriteRuntimeTargetsToBuild(originalImports)
      }
      if (originalExports) {
        rewrittenPkg['exports'] = Pkg.Manifest.rewriteRuntimeTargetsToBuild(originalExports)
      }
      yield* fs.writeFileString(packageJsonPath, JSON.stringify(rewrittenPkg, null, 2) + '\n')
    }

    // 4. Publish with guaranteed manifest restoration.
    const publishResult = yield* cli
      .publish({
        cwd: pkgDir,
        access: 'public',
        ...(options?.tag && { tag: options.tag }),
        ...(options?.registry && { registry: options.registry }),
      })
      .pipe(Effect.either)

    const restoreResult = yield* Effect.gen(function* () {
      // Restore version via typed manifest
      yield* Pkg.Manifest.resource.update(pkgDir, (m) =>
        remakeManifestWithVersion(m, originalVersion),
      )

      // Restore original imports/exports
      if (originalImports || originalExports) {
        const currentJson = yield* fs.readFileString(packageJsonPath)
        const currentPkg = { ...(yield* decodeJsonRecordOrFail(currentJson)) }
        if (originalImports) {
          currentPkg['imports'] = originalImports
        }
        if (originalExports) {
          currentPkg['exports'] = originalExports
        }
        yield* fs.writeFileString(packageJsonPath, JSON.stringify(currentPkg, null, 2) + '\n')
      }
    }).pipe(Effect.either)

    if (Either.isLeft(publishResult)) {
      const cleanupFailureDetail = Either.isLeft(restoreResult)
        ? formatUnknownError(restoreResult.left)
        : undefined
      return yield* Effect.fail(
        new PublishError({
          context: {
            package: release.package.path,
            detail: renderPublishFailureDetail(
              cleanupFailureDetail === undefined
                ? {
                    publishError: publishResult.left,
                    publishHooks,
                  }
                : {
                    publishError: publishResult.left,
                    cleanupFailureDetail,
                    publishHooks,
                  },
            ),
          },
        }),
      )
    }

    if (Either.isLeft(restoreResult)) {
      return yield* Effect.fail(
        new PublishError({
          context: {
            package: release.package.path,
            detail: renderCleanupFailureDetail({
              cleanupError: restoreResult.left,
              publishHooks,
            }),
          },
        }),
      )
    }
  })

/**
 * Publish all packages in a release plan.
 *
 * Packages are published sequentially to handle dependency ordering.
 */
export const publishAll = (
  releases: ReleaseInfo[],
  options?: PublishOptions,
): Effect.Effect<
  void,
  PublishError | Resource.ResourceError | PlatformError,
  FileSystem.FileSystem | NpmRegistry.NpmCli
> =>
  Effect.gen(function* () {
    for (const release of releases) {
      yield* publishPackage(release, options)
    }
  })

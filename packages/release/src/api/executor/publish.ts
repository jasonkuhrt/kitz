import { FileSystem } from '@effect/platform'
import type { PlatformError } from '@effect/platform/Error'
import { Err } from '@kitz/core'
import { Env } from '@kitz/env'
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
const artifactRelDir = Fs.Path.RelDir.fromString('./.release/artifacts/')

/**
 * Minimal release info needed for publish preparation and tarball publish.
 */
export interface ReleaseInfo {
  readonly package: Package
  readonly nextVersion: Semver.Semver
}

export interface PreparedArtifact extends ReleaseInfo {
  readonly tarball: Fs.Path.AbsFile
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
 * Options for tarball publish.
 */
export interface PublishOptions {
  /** npm dist-tag (default: 'latest') */
  readonly tag?: string
  /** Registry URL */
  readonly registry?: string
}

const formatUnknownError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

const decodeJsonRecordOrFail = (pkgDir: Fs.Path.AbsDir, json: string) =>
  decodeJsonRecord(json).pipe(
    Effect.mapError(
      () =>
        new PublishError({
          context: { package: pkgDir },
        }),
    ),
  )

const slugPackageName = (packageName: string): string =>
  packageName.replace(/^@/u, '').replace(/\//gu, '-')

const artifactFilename = (release: ReleaseInfo): string =>
  `${slugPackageName(release.package.name.moniker)}-${Semver.toString(release.nextVersion)}.tgz`

const workspaceVersionsFor = (
  releases: readonly ReleaseInfo[],
): Readonly<Record<string, Semver.Semver>> =>
  Object.fromEntries(releases.map((release) => [release.package.name.moniker, release.nextVersion]))

const renderCleanupReminder = (): string =>
  'Re-run `release doctor --onlyRule plan.packages-runtime-targets-source-oriented` after publish to confirm the repo returned to source-first state.'

const renderPackHookDisclaimer = (hooks: readonly string[]): string | undefined =>
  hooks.length === 0
    ? undefined
    : `Pack hooks detected (${hooks.join(', ')}). Release packed the artifact successfully, but those scripts may still have left local cleanup behind.`

const renderPrepareFailureDetail = (params: {
  readonly prepareError: unknown
  readonly cleanupFailureDetail?: string
  readonly packHooks: readonly string[]
}): string =>
  [
    formatUnknownError(params.prepareError),
    params.cleanupFailureDetail === undefined
      ? 'Manifest cleanup restored version, runtime targets, and dependency specifiers.'
      : `Manifest cleanup failed: ${params.cleanupFailureDetail}. Inspect package.json before retrying.`,
    renderPackHookDisclaimer(params.packHooks),
    renderCleanupReminder(),
  ]
    .filter((part) => part !== undefined)
    .join(' ')

const renderCleanupWarning = (params: {
  readonly cleanupError: unknown
  readonly packHooks: readonly string[]
}): string =>
  [
    `Artifact prepared, but manifest cleanup failed: ${formatUnknownError(params.cleanupError)}.`,
    'Publish can continue because the tarball is already packed, but the local repo may be left dirty until you restore package.json.',
    renderPackHookDisclaimer(params.packHooks),
    renderCleanupReminder(),
  ]
    .filter((part) => part !== undefined)
    .join(' ')

const renderPublishFailureDetail = (publishError: unknown): string =>
  [
    formatUnknownError(publishError),
    'Tarball publish ran with lifecycle scripts disabled, so this failure happened after artifact preparation.',
  ].join(' ')

/**
 * Deterministic artifact path for a prepared package tarball.
 */
export const artifactPathFor = (repoRoot: Fs.Path.AbsDir, release: ReleaseInfo): Fs.Path.AbsFile =>
  Fs.Path.join(
    Fs.Path.join(repoRoot, artifactRelDir),
    Fs.Path.RelFile.fromString(`./${artifactFilename(release)}`),
  )

/**
 * Prepare a publish tarball by rewriting the manifest into publish shape,
 * running `npm pack`, and restoring the original manifest immediately after.
 */
export const preparePackageArtifact = (
  release: ReleaseInfo,
  releases: readonly ReleaseInfo[],
): Effect.Effect<
  PreparedArtifact,
  PublishError | Resource.ResourceError | PlatformError,
  FileSystem.FileSystem | NpmRegistry.NpmCli | Env.Env
> =>
  Effect.gen(function* () {
    const cli = yield* NpmRegistry.NpmCli
    const env = yield* Env.Env
    const fs = yield* FileSystem.FileSystem
    const packageJsonPath = Fs.Path.join(
      release.package.path,
      Fs.Path.RelFile.fromString('./package.json'),
    )
    const packageJsonPathString = Fs.Path.toString(packageJsonPath)
    const artifactDir = Fs.Path.join(env.cwd, artifactRelDir)
    const artifactPath = artifactPathFor(env.cwd, release)

    const originalJson = yield* fs.readFileString(packageJsonPathString)
    const originalManifest = yield* decodeJsonRecordOrFail(release.package.path, originalJson)
    const typedManifest = yield* Pkg.Manifest.resource.readOrEmpty(release.package.path)
    const packHooks = Pkg.Manifest.findPackHooks(typedManifest.scripts)
    const rewrittenManifest = Pkg.Manifest.rewriteManifestForPack(originalManifest, {
      version: release.nextVersion,
      workspaceVersions: workspaceVersionsFor(releases),
    })

    yield* fs.writeFileString(
      packageJsonPathString,
      JSON.stringify(rewrittenManifest, null, 2) + '\n',
    )
    yield* fs.makeDirectory(Fs.Path.toString(artifactDir), { recursive: true })
    yield* fs
      .remove(Fs.Path.toString(artifactPath), { force: true })
      .pipe(Effect.catchAll(() => Effect.void))

    const packResult = yield* cli
      .pack({
        cwd: release.package.path,
        packDestination: artifactDir,
      })
      .pipe(Effect.either)

    const restoreResult = yield* fs
      .writeFileString(packageJsonPathString, originalJson)
      .pipe(Effect.either)

    if (Either.isLeft(packResult)) {
      const cleanupFailureDetail = Either.isLeft(restoreResult)
        ? formatUnknownError(restoreResult.left)
        : undefined
      return yield* Effect.fail(
        new PublishError({
          context: {
            package: release.package.path,
            detail: renderPrepareFailureDetail({
              prepareError: packResult.left,
              ...(cleanupFailureDetail === undefined ? {} : { cleanupFailureDetail }),
              packHooks,
            }),
          },
        }),
      )
    }

    if (Fs.Path.toString(packResult.right.tarball) !== Fs.Path.toString(artifactPath)) {
      yield* fs.rename(Fs.Path.toString(packResult.right.tarball), Fs.Path.toString(artifactPath))
    }

    if (Either.isLeft(restoreResult)) {
      yield* Effect.logWarning(
        `[release] ${release.package.name.moniker}: ${renderCleanupWarning({
          cleanupError: restoreResult.left,
          packHooks,
        })}`,
      )
    }

    return {
      ...release,
      tarball: artifactPath,
    }
  })

/**
 * Publish a prepared tarball artifact with lifecycle scripts disabled.
 */
export const publishPreparedArtifact = (
  artifact: PreparedArtifact,
  options?: PublishOptions,
): Effect.Effect<void, PublishError, NpmRegistry.NpmCli> =>
  Effect.gen(function* () {
    const cli = yield* NpmRegistry.NpmCli

    const publishResult = yield* cli
      .publish({
        tarball: artifact.tarball,
        access: 'public',
        ignoreScripts: true,
        ...(options?.tag && { tag: options.tag }),
        ...(options?.registry && { registry: options.registry }),
      })
      .pipe(Effect.either)

    if (Either.isLeft(publishResult)) {
      return yield* Effect.fail(
        new PublishError({
          context: {
            package: artifact.package.path,
            detail: renderPublishFailureDetail(publishResult.left),
          },
        }),
      )
    }
  })

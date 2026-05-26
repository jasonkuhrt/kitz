import { PlatformError, FileSystem } from 'effect'
import { Err } from '@kitz/core'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { NpmRegistry } from '@kitz/npm-registry'
import { Pkg } from '@kitz/pkg'
import { Resource } from '@kitz/resource'
import { Semver } from '@kitz/semver'
import { Effect, Result, Schema as S } from 'effect'
import type { Package } from '../analyzer/workspace.js'

const baseTags = ['kit', 'release', 'publish'] as const
const PublishErrorContext = S.Struct({
  package: Fs.Path.AbsDir.Schema,
  detail: S.optional(S.String),
})
const JsonRecordSchema = S.Record(S.String, S.Unknown)
const JsonRecordFromStringSchema = S.fromJsonString(JsonRecordSchema)
const decodeJsonRecord = S.decodeUnknownEffect(JsonRecordFromStringSchema)
const artifactRelDir = Fs.Path.RelDir.fromString('./.release/artifacts/')
const workspaceRelDir = Fs.Path.RelDir.fromString('./.release/workspaces/')
const stagingIgnore: readonly string[] = ['.git', '.release', 'node_modules']

/**
 * Minimal release info needed for publish preparation and tarball publish.
 */
export interface ReleaseInfo {
  readonly package: Package
  readonly nextVersion: Semver.Semver
}

export interface PreparedArtifact extends ReleaseInfo {
  readonly tarball: Fs.Path.AbsFile
  readonly packMetadata?: NpmRegistry.Cli.PackResult
}

export interface ArtifactPathOptions {
  readonly planDigest?: string
  readonly packEnv?: Readonly<Record<string, string | undefined>>
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
  /** Simulate the package-manager publish command without a registry mutation. */
  readonly dryRun?: boolean
  /** OTP value supplied through a provider-approved path. */
  readonly otp?: string
  /** Request provider-native provenance. */
  readonly provenance?: boolean
  /** Use a precomputed provenance bundle. */
  readonly provenanceFile?: Fs.Path.AbsFile
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

const stagedPackageDirFor = (repoRoot: Fs.Path.AbsDir, release: ReleaseInfo): Fs.Path.AbsDir =>
  Fs.Path.join(
    Fs.Path.join(repoRoot, workspaceRelDir),
    Fs.Path.RelDir.fromString(
      `./${slugPackageName(release.package.name.moniker)}-${Semver.toString(release.nextVersion)}/`,
    ),
  )

const copyPackageDirectory = (
  from: Fs.Path.AbsDir,
  to: Fs.Path.AbsDir,
): Effect.Effect<void, PlatformError.PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const fromString = Fs.Path.toString(from)
    const toString = Fs.Path.toString(to)

    yield* fs.makeDirectory(toString, { recursive: true })
    const entries = yield* fs.readDirectory(fromString)

    for (const entry of entries) {
      if (stagingIgnore.includes(entry)) continue

      const source = `${fromString}${entry}`
      const target = `${toString}${entry}`
      const stat = yield* fs.stat(source)

      if (stat.type === 'Directory') {
        yield* copyPackageDirectory(
          Fs.Path.AbsDir.fromString(`${source}/`),
          Fs.Path.AbsDir.fromString(`${target}/`),
        )
        continue
      }

      if (stat.type === 'File') {
        const bytes = yield* fs.readFile(source)
        yield* fs.writeFile(target, bytes)
      }
    }
  })

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
  readonly packHooks: readonly string[]
}): string =>
  [
    formatUnknownError(params.prepareError),
    'Source package manifests were not mutated; packing ran from an isolated release workspace.',
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
const artifactDirectoryFor = (
  repoRoot: Fs.Path.AbsDir,
  options?: ArtifactPathOptions,
): Fs.Path.AbsDir =>
  options?.planDigest === undefined
    ? Fs.Path.join(repoRoot, artifactRelDir)
    : Fs.Path.join(
        Fs.Path.join(repoRoot, artifactRelDir),
        Fs.Path.RelDir.fromString(`./${options.planDigest}/`),
      )

export const artifactPathFor = (
  repoRoot: Fs.Path.AbsDir,
  release: ReleaseInfo,
  options?: ArtifactPathOptions,
): Fs.Path.AbsFile =>
  Fs.Path.join(
    artifactDirectoryFor(repoRoot, options),
    Fs.Path.RelFile.fromString(`./${artifactFilename(release)}`),
  )

/**
 * Prepare a publish tarball by rewriting the manifest into publish shape,
 * running `npm pack`, and restoring the original manifest immediately after.
 */
export const preparePackageArtifact = (
  release: ReleaseInfo,
  releases: readonly ReleaseInfo[],
  options?: ArtifactPathOptions,
): Effect.Effect<
  PreparedArtifact,
  PublishError | Resource.ResourceError | PlatformError.PlatformError,
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
    const artifactDir = artifactDirectoryFor(env.cwd, options)
    const artifactPath = artifactPathFor(env.cwd, release, options)
    const stagedPackageDir = stagedPackageDirFor(env.cwd, release)
    const stagedPackageJsonPath = Fs.Path.join(
      stagedPackageDir,
      Fs.Path.RelFile.fromString('./package.json'),
    )

    const originalJson = yield* fs.readFileString(packageJsonPathString)
    const originalManifest = yield* decodeJsonRecordOrFail(release.package.path, originalJson)
    const typedManifest = yield* Pkg.Manifest.resource.readOrEmpty(release.package.path)
    const packHooks = Pkg.Manifest.findPackHooks(typedManifest.scripts)
    const rewrittenManifest = Pkg.Manifest.rewriteManifestForPack(originalManifest, {
      version: release.nextVersion,
      workspaceVersions: workspaceVersionsFor(releases),
    })

    yield* fs
      .remove(Fs.Path.toString(stagedPackageDir), { recursive: true, force: true })
      .pipe(Effect.ignore)
    yield* copyPackageDirectory(release.package.path, stagedPackageDir)
    yield* fs.writeFileString(
      Fs.Path.toString(stagedPackageJsonPath),
      JSON.stringify(rewrittenManifest, null, 2) + '\n',
    )
    yield* fs.makeDirectory(Fs.Path.toString(artifactDir), { recursive: true })
    yield* fs.remove(Fs.Path.toString(artifactPath), { force: true }).pipe(Effect.ignore)

    const packResult = yield* cli
      .pack({
        cwd: stagedPackageDir,
        packDestination: artifactDir,
        ...(options?.packEnv !== undefined ? { env: options.packEnv } : {}),
      })
      .pipe(Effect.result)

    if (Result.isFailure(packResult)) {
      return yield* Effect.fail(
        new PublishError({
          context: {
            package: release.package.path,
            detail: renderPrepareFailureDetail({
              prepareError: packResult.failure,
              packHooks,
            }),
          },
        }),
      )
    }

    if (Fs.Path.toString(packResult.success.tarball) !== Fs.Path.toString(artifactPath)) {
      yield* fs.rename(Fs.Path.toString(packResult.success.tarball), Fs.Path.toString(artifactPath))
    }

    return {
      ...release,
      tarball: artifactPath,
      packMetadata: {
        ...packResult.success,
        tarball: artifactPath,
      },
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
        ...(options?.dryRun === true ? { dryRun: true } : {}),
        ...(options?.otp !== undefined ? { otp: options.otp } : {}),
        ...(options?.provenance === true ? { provenance: true } : {}),
        ...(options?.provenanceFile !== undefined
          ? { provenanceFile: options.provenanceFile }
          : {}),
      })
      .pipe(Effect.result)

    if (Result.isFailure(publishResult)) {
      return yield* Effect.fail(
        new PublishError({
          context: {
            package: artifact.package.path,
            detail: renderPublishFailureDetail(publishResult.failure),
          },
        }),
      )
    }
  })

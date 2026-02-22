import { FileSystem } from '@effect/platform'
import { Err } from '@kitz/core'
import { Fs } from '@kitz/fs'
import { NpmRegistry } from '@kitz/npm-registry'
import { Pkg } from '@kitz/pkg'
import { Resource } from '@kitz/resource'
import { Semver } from '@kitz/semver'
import { Effect, Schema as S } from 'effect'
import type { Package } from '../analyzer/workspace.js'

const baseTags = ['kit', 'release', 'publish'] as const

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
export const PublishError = Err.TaggedContextualError(
  'PublishError',
  baseTags,
  {
    context: S.Struct({
      package: Fs.Path.AbsDir.Schema,
    }),
    message: (ctx) => `Failed to publish package at ${Fs.Path.toString(ctx.package)}`,
  },
)

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

/**
 * Publish a single package with version injection and restoration.
 *
 * Requires `NpmRegistry.NpmCli` service - provide `NpmRegistry.NpmCliLive`
 * for actual publishing or `NpmRegistry.NpmCliDryRun` for dry-run mode.
 */
export const publishPackage = (
  release: ReleaseInfo,
  options?: PublishOptions,
): Effect.Effect<
  void,
  PublishError | Resource.ResourceError | NpmRegistry.NpmCliError,
  FileSystem.FileSystem | NpmRegistry.NpmCli
> =>
  Effect.gen(function*() {
    const pkgDir = release.package.path
    const cli = yield* NpmRegistry.NpmCli

    // 1. Inject the new version, capturing original for restore
    const manifest = yield* Pkg.Manifest.resource.readOrEmpty(pkgDir)
    const originalVersion = manifest.version
    yield* Pkg.Manifest.resource.write(
      Pkg.Manifest.Manifest.make({ ...manifest, version: release.nextVersion }),
      pkgDir,
    )

    // 2. Publish (with guaranteed cleanup)
    yield* Effect.ensuring(
      cli.publish({
        cwd: pkgDir,
        access: 'public',
        ...(options?.tag && { tag: options.tag }),
        ...(options?.registry && { registry: options.registry }),
      }),
      // Always restore version, even on failure
      Pkg.Manifest.resource.update(pkgDir, (m) => Pkg.Manifest.Manifest.make({ ...m, version: originalVersion })).pipe(
        Effect.ignore,
      ),
    )
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
  PublishError | Resource.ResourceError | NpmRegistry.NpmCliError,
  FileSystem.FileSystem | NpmRegistry.NpmCli
> =>
  Effect.gen(function*() {
    for (const release of releases) {
      yield* publishPackage(release, options)
    }
  })

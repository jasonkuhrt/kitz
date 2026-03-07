import { FileSystem } from '@effect/platform'
import type { PlatformError } from '@effect/platform/Error'
import { Err } from '@kitz/core'
import { Fs } from '@kitz/fs'
import { NpmRegistry } from '@kitz/npm-registry'
import { Pkg } from '@kitz/pkg'
import { Resource } from '@kitz/resource'
import { Semver } from '@kitz/semver'
import { Effect, Schema as S } from 'effect'
import type { Package } from '../analyzer/workspace.js'

const baseTags = ['kit', 'release', 'publish'] as const
const PublishErrorContext = S.Struct({
  package: Fs.Path.AbsDir.Schema,
})

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
  message: (ctx) => `Failed to publish package at ${Fs.Path.toString(ctx.package)}`,
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

/**
 * Rewrite imports string values from source paths to build paths for publishing.
 *
 * Transforms `./src/*.ts` to `./build/*.js` so published packages resolve
 * correctly at runtime (source imports are used during development only).
 */
const rewriteImportsForPublish = (imports: Record<string, unknown>): Record<string, unknown> => {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(imports)) {
    if (typeof value === 'string') {
      result[key] = value.replace(/^\.\/src\//, './build/').replace(/\.ts$/, '.js')
    } else {
      result[key] = value // preserve conditional imports as-is
    }
  }
  return result
}

/**
 * Publish a single package with version injection and restoration.
 *
 * Rewrites package.json `imports` from source paths (`./src/*.ts`) to
 * build paths (`./build/*.js`) before publishing, then restores originals.
 *
 * Requires `NpmRegistry.NpmCli` service - provide `NpmRegistry.NpmCliLive`
 * for actual publishing or `NpmRegistry.NpmCliDryRun` for dry-run mode.
 */
export const publishPackage = (
  release: ReleaseInfo,
  options?: PublishOptions,
): Effect.Effect<
  void,
  PublishError | Resource.ResourceError | NpmRegistry.NpmCliError | PlatformError,
  FileSystem.FileSystem | NpmRegistry.NpmCli
> =>
  Effect.gen(function* () {
    const remakeManifestWithVersion = (
      manifest: Pkg.Manifest.Manifest,
      version: Pkg.Manifest.Manifest[`version`],
    ): Pkg.Manifest.Manifest => Pkg.Manifest.Manifest.make(Object.assign({}, manifest, { version }))

    const pkgDir = release.package.path
    const cli = yield* NpmRegistry.NpmCli
    const fs = yield* FileSystem.FileSystem

    // 1. Read raw package.json to access the imports field
    const packageJsonPath = `${Fs.Path.toString(pkgDir)}package.json`
    const rawJson = yield* fs.readFileString(packageJsonPath)
    const rawPkg = JSON.parse(rawJson) as Record<string, unknown>
    const originalImports = rawPkg['imports'] as Record<string, unknown> | undefined

    // 2. Inject the new version, capturing original for restore
    const manifest = yield* Pkg.Manifest.resource.readOrEmpty(pkgDir)
    const originalVersion = manifest.version
    yield* Pkg.Manifest.resource.write(
      remakeManifestWithVersion(manifest, release.nextVersion),
      pkgDir,
    )

    // 3. Rewrite imports for publish (source paths -> build paths)
    if (originalImports) {
      const rewrittenJson = yield* fs.readFileString(packageJsonPath)
      const rewrittenPkg = JSON.parse(rewrittenJson) as Record<string, unknown>
      rewrittenPkg['imports'] = rewriteImportsForPublish(originalImports)
      yield* fs.writeFileString(packageJsonPath, JSON.stringify(rewrittenPkg, null, 2) + '\n')
    }

    // 4. Publish (with guaranteed cleanup)
    yield* Effect.ensuring(
      cli.publish({
        cwd: pkgDir,
        access: 'public',
        ...(options?.tag && { tag: options.tag }),
        ...(options?.registry && { registry: options.registry }),
      }),
      // Always restore version and imports, even on failure
      Effect.gen(function* () {
        // Restore version via typed manifest
        yield* Pkg.Manifest.resource.update(pkgDir, (m) =>
          remakeManifestWithVersion(m, originalVersion),
        )

        // Restore original imports
        if (originalImports) {
          const currentJson = yield* fs.readFileString(packageJsonPath)
          const currentPkg = JSON.parse(currentJson) as Record<string, unknown>
          currentPkg['imports'] = originalImports
          yield* fs.writeFileString(packageJsonPath, JSON.stringify(currentPkg, null, 2) + '\n')
        }
      }).pipe(Effect.ignore),
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
  PublishError | Resource.ResourceError | NpmRegistry.NpmCliError | PlatformError,
  FileSystem.FileSystem | NpmRegistry.NpmCli
> =>
  Effect.gen(function* () {
    for (const release of releases) {
      yield* publishPackage(release, options)
    }
  })

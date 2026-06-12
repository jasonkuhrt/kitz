/**
 * In-memory implementation of the {@link NpmCli} service.
 *
 * Follows the kitz Memory-layer pattern (see `@kitz/git` `Git.Memory`):
 * Ref-backed registry state, ordered call recording, failure injection, and
 * an inspectable state handle returned alongside the layer via
 * {@link makeWithState}.
 *
 * Registry semantics are honest:
 * - `pack` reads `<cwd>/package.json` through the ambient `FileSystem`
 *   service and writes a fake tarball file to the pack destination.
 * - `publish` registers the version and dist-tag in the in-memory registry —
 *   unless it fails (injected) or is a `dryRun`, neither of which mutates
 *   registry state.
 * - `hasVersion` / `observeVersion` answer from seeded versions plus publish
 *   receipts; {@link NpmCliMemoryConfig.missingVersions} hides versions to
 *   simulate registry lag.
 *
 * Requires `FileSystem.FileSystem` (e.g. `Fs.Memory.layer` in tests).
 */

import { Fs } from '@kitz/fs'
import { Effect, FileSystem, Layer, Ref, Schema as S } from 'effect'
import type {
  AccessOptions,
  AccessStatus,
  ObserveVersionOptions,
  PackOptions,
  PackResult,
  PublishOptions,
  RegistryVersionObservation,
  ViewOptions,
  WhoamiOptions,
} from './cli.js'
import { NpmCliError } from './cli.js'
import { NpmCli, type NpmCliService } from './service.js'
import * as Tarball from './tarball.js'

const DEFAULT_REGISTRY = 'https://registry.npmjs.org'
const DEFAULT_USER = 'memory-user'

const JsonRecordFromString = S.fromJsonString(S.Record(S.String, S.Unknown))
const decodeJsonRecord = S.decodeUnknownEffect(JsonRecordFromString)

const sha256Hex = (bytes: Uint8Array): Effect.Effect<string> =>
  Effect.promise(async () => {
    const digest = await crypto.subtle.digest('SHA-256', bytes.slice().buffer)
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
  })

const toError = (cause: unknown): Error =>
  cause instanceof Error ? cause : new Error(String(cause))

// ============================================================================
// Configuration
// ============================================================================

/**
 * Configuration for the in-memory NpmCli service.
 */
export interface NpmCliMemoryConfig {
  /** Username reported by `whoami` (default: 'memory-user'). */
  readonly user?: string | undefined
  /** Seeded registry versions per package name. */
  readonly published?: Readonly<Record<string, readonly string[]>> | undefined
  /** Seeded dist-tags per package name. */
  readonly distTags?: Readonly<Record<string, Readonly<Record<string, string>>>> | undefined
  /** Package names whose `pack` fails with a typed {@link NpmCliError}. */
  readonly failPackPackages?: readonly string[] | undefined
  /** Package names whose `publish` fails with a typed {@link NpmCliError}. */
  readonly failPublishPackages?: readonly string[] | undefined
  /**
   * `name@version` specs hidden from `hasVersion` / `observeVersion` even
   * after a successful publish — simulates registry propagation lag.
   */
  readonly missingVersions?: readonly string[] | undefined
  /** Access status reported by `getAccessStatus` (default: 'public'). */
  readonly accessStatus?: AccessStatus | undefined
  /** Listing reported by `listAccessPackages` (default: `{}`). */
  readonly accessPackages?: Readonly<Record<string, string>> | undefined
  /** Listing reported by `listAccessCollaborators` (default: `{}`). */
  readonly accessCollaborators?: Readonly<Record<string, string>> | undefined
}

// ============================================================================
// Records
// ============================================================================

/**
 * One recorded service invocation. Every method call — including failed and
 * dry-run ones — is appended to {@link NpmCliMemoryState.calls} in order.
 */
export type NpmCliCall =
  | { readonly operation: 'whoami'; readonly options: WhoamiOptions | undefined }
  | { readonly operation: 'pack'; readonly options: PackOptions }
  | { readonly operation: 'publish'; readonly options: PublishOptions }
  | {
      readonly operation: 'hasVersion'
      readonly packageName: string
      readonly version: string
      readonly options: ViewOptions | undefined
    }
  | {
      readonly operation: 'observeVersion'
      readonly packageName: string
      readonly version: string
      readonly options: ObserveVersionOptions | undefined
    }
  | {
      readonly operation: 'listAccessPackages'
      readonly userOrScope: string
      readonly options: AccessOptions | undefined
    }
  | {
      readonly operation: 'listAccessCollaborators'
      readonly packageName: string
      readonly options: AccessOptions | undefined
    }
  | {
      readonly operation: 'getAccessStatus'
      readonly packageName: string
      readonly options: AccessOptions | undefined
    }

/**
 * A successful `pack` product.
 */
export interface PackReceipt {
  readonly packageName: string
  readonly version: string
  /** Tarball filename (`<slug>-<version>.tgz`). */
  readonly filename: string
  /** Absolute tarball path inside the pack destination. */
  readonly tarball: Fs.Path.AbsFile
  /** Options the caller passed to `pack`. */
  readonly options: PackOptions
  /** Decoded `package.json` of the packed directory. */
  readonly manifest: Readonly<Record<string, unknown>>
}

/**
 * A successful, non-dry-run `publish`.
 */
export interface PublishReceipt {
  readonly tarball: Fs.Path.AbsFile
  /** Resolved from the matching pack receipt when available. */
  readonly packageName: string | undefined
  /** Resolved from the matching pack receipt when available. */
  readonly version: string | undefined
  /** Dist-tag the version was published under (default: 'latest'). */
  readonly tag: string
  /** Options the caller passed to `publish`. */
  readonly options: PublishOptions
}

// ============================================================================
// State
// ============================================================================

/**
 * Mutable state for the in-memory NpmCli service.
 *
 * Useful for:
 * - Verifying what operations were performed (and in what order)
 * - Dynamically updating failure injection during execution
 * - Inspecting final registry state after operations
 */
export interface NpmCliMemoryState {
  /** Username reported by `whoami`. */
  readonly user: Ref.Ref<string>
  /** Every service call in invocation order (including failed and dry-run calls). */
  readonly calls: Ref.Ref<readonly NpmCliCall[]>
  /** Successful pack products. */
  readonly packReceipts: Ref.Ref<readonly PackReceipt[]>
  /** Successful non-dry-run publishes. */
  readonly publishReceipts: Ref.Ref<readonly PublishReceipt[]>
  /** Registry versions per package (seeded + published). */
  readonly published: Ref.Ref<Readonly<Record<string, readonly string[]>>>
  /** Dist-tags per package (seeded + published). */
  readonly distTags: Ref.Ref<Readonly<Record<string, Readonly<Record<string, string>>>>>
  /** Package names whose `pack` fails. */
  readonly failPackPackages: Ref.Ref<readonly string[]>
  /** Package names whose `publish` fails. */
  readonly failPublishPackages: Ref.Ref<readonly string[]>
  /** `name@version` specs hidden from registry reads. */
  readonly missingVersions: Ref.Ref<readonly string[]>
  /** Access status reported by `getAccessStatus`. */
  readonly accessStatus: Ref.Ref<AccessStatus>
  /** Listing reported by `listAccessPackages`. */
  readonly accessPackages: Ref.Ref<Readonly<Record<string, string>>>
  /** Listing reported by `listAccessCollaborators`. */
  readonly accessCollaborators: Ref.Ref<Readonly<Record<string, string>>>
}

/**
 * Create the initial state from config.
 */
export const makeState = (config: NpmCliMemoryConfig = {}): Effect.Effect<NpmCliMemoryState> =>
  Effect.all({
    user: Ref.make(config.user ?? DEFAULT_USER),
    calls: Ref.make<readonly NpmCliCall[]>([]),
    packReceipts: Ref.make<readonly PackReceipt[]>([]),
    publishReceipts: Ref.make<readonly PublishReceipt[]>([]),
    published: Ref.make<Readonly<Record<string, readonly string[]>>>(config.published ?? {}),
    distTags: Ref.make<Readonly<Record<string, Readonly<Record<string, string>>>>>(
      config.distTags ?? {},
    ),
    failPackPackages: Ref.make<readonly string[]>(config.failPackPackages ?? []),
    failPublishPackages: Ref.make<readonly string[]>(config.failPublishPackages ?? []),
    missingVersions: Ref.make<readonly string[]>(config.missingVersions ?? []),
    accessStatus: Ref.make<AccessStatus>(config.accessStatus ?? 'public'),
    accessPackages: Ref.make<Readonly<Record<string, string>>>(config.accessPackages ?? {}),
    accessCollaborators: Ref.make<Readonly<Record<string, string>>>(
      config.accessCollaborators ?? {},
    ),
  })

// ============================================================================
// Internal helpers
// ============================================================================

const record = (state: NpmCliMemoryState, call: NpmCliCall): Effect.Effect<void> =>
  Ref.update(state.calls, (calls) => [...calls, call])

const findLast = <item>(
  items: readonly item[],
  predicate: (item: item) => boolean,
): item | undefined => {
  for (let index = items.length - 1; index >= 0; index--) {
    const item = items[index]!
    if (predicate(item)) return item
  }
  return undefined
}

const tarballBasename = (tarball: Fs.Path.AbsFile): string => {
  const path = Fs.Path.toString(tarball)
  return path.split('/').at(-1) ?? path
}

/** Match a publish receipt to a `name@version` by its tarball filename. */
const receiptMatches = (receipt: PublishReceipt, packageName: string, version: string): boolean =>
  tarballBasename(receipt.tarball) === Tarball.filename(packageName, version)

/** Is this tarball blocked by failure injection? */
const isBlocked = (
  blocked: readonly string[],
  packageName: string | undefined,
  tarball: Fs.Path.AbsFile,
): boolean => {
  if (packageName !== undefined && blocked.includes(packageName)) return true
  const basename = tarballBasename(tarball)
  return blocked.some((name) => basename.startsWith(`${Tarball.slugifyPackageName(name)}-`))
}

const registryBase = (registry: string | undefined): string =>
  (registry ?? DEFAULT_REGISTRY).replace(/\/$/u, '')

const tarballUrlFor = (
  registry: string | undefined,
  packageName: string,
  version: string,
): string => `${registryBase(registry)}/${packageName}/-/${Tarball.filename(packageName, version)}`

const packError = (detail: string): NpmCliError =>
  new NpmCliError({
    context: { operation: 'pack', detail },
    cause: new Error(detail),
  })

const viewError = (detail: string): NpmCliError =>
  new NpmCliError({
    context: { operation: 'view', detail },
    cause: new Error(detail),
  })

// ============================================================================
// Service
// ============================================================================

const makeService = (state: NpmCliMemoryState, fs: FileSystem.FileSystem): NpmCliService => {
  const isHidden = (packageName: string, version: string): Effect.Effect<boolean> =>
    Ref.get(state.missingVersions).pipe(
      Effect.map((missing) => missing.includes(`${packageName}@${version}`)),
    )

  const isPublished = (packageName: string, version: string): Effect.Effect<boolean> =>
    Effect.gen(function* () {
      const published = yield* Ref.get(state.published)
      if (published[packageName]?.includes(version)) return true
      const receipts = yield* Ref.get(state.publishReceipts)
      return receipts.some((receipt) => receiptMatches(receipt, packageName, version))
    })

  return {
    whoami: (options?: WhoamiOptions) =>
      Effect.gen(function* () {
        yield* record(state, { operation: 'whoami', options })
        return yield* Ref.get(state.user)
      }),

    pack: (options: PackOptions) =>
      Effect.gen(function* () {
        yield* record(state, { operation: 'pack', options })

        const packageJsonPath = Fs.Path.join(
          options.cwd,
          Fs.Path.RelFile.fromString('./package.json'),
        )
        const manifestRaw = yield* fs
          .readFileString(Fs.Path.toString(packageJsonPath))
          .pipe(
            Effect.mapError(() => packError(`failed to read ${Fs.Path.toString(packageJsonPath)}`)),
          )
        const manifest = yield* decodeJsonRecord(manifestRaw).pipe(
          Effect.mapError(() => packError(`invalid JSON in ${Fs.Path.toString(packageJsonPath)}`)),
        )

        const packageName = manifest['name']
        const version = manifest['version']
        if (typeof packageName !== 'string' || typeof version !== 'string') {
          return yield* Effect.fail(
            packError(
              `package.json in ${Fs.Path.toString(options.cwd)} must have string name and version`,
            ),
          )
        }

        const blocked = yield* Ref.get(state.failPackPackages)
        if (blocked.includes(packageName)) {
          return yield* Effect.fail(packError(`pack failure injected for ${packageName}`))
        }

        const filename = Tarball.filename(packageName, version)
        const tarball = Tarball.path(options.packDestination, packageName, version)

        yield* fs
          .writeFileString(Fs.Path.toString(tarball), `packed:${packageName}@${version}`)
          .pipe(
            Effect.mapError(
              (cause) =>
                new NpmCliError({
                  context: {
                    operation: 'pack',
                    detail: `failed to write tarball ${Fs.Path.toString(tarball)}`,
                  },
                  cause: toError(cause),
                }),
            ),
          )

        yield* Ref.update(state.packReceipts, (receipts) => [
          ...receipts,
          { packageName, version, filename, tarball, options, manifest },
        ])

        return { tarball, filename } satisfies PackResult
      }),

    publish: (options: PublishOptions) =>
      Effect.gen(function* () {
        yield* record(state, { operation: 'publish', options })

        const packReceipts = yield* Ref.get(state.packReceipts)
        const packReceipt = findLast(
          packReceipts,
          (receipt) => Fs.Path.toString(receipt.tarball) === Fs.Path.toString(options.tarball),
        )
        const packageName = packReceipt?.packageName
        const version = packReceipt?.version

        const blocked = yield* Ref.get(state.failPublishPackages)
        if (isBlocked(blocked, packageName, options.tarball)) {
          const subject = packageName ?? tarballBasename(options.tarball)
          yield* Effect.fail(
            new NpmCliError({
              context: {
                operation: 'publish',
                detail: `publish failure injected for ${subject}`,
              },
              cause: new Error(`publish failure injected for ${subject}`),
            }),
          )
        }

        // Dry runs do not mutate registry state.
        if (options.dryRun === true) return

        const tag = options.tag ?? 'latest'
        yield* Ref.update(state.publishReceipts, (receipts) => [
          ...receipts,
          { tarball: options.tarball, packageName, version, tag, options },
        ])

        if (packageName !== undefined && version !== undefined) {
          yield* Ref.update(state.published, (published) => ({
            ...published,
            [packageName]: published[packageName]?.includes(version)
              ? published[packageName]
              : [...(published[packageName] ?? []), version],
          }))
          yield* Ref.update(state.distTags, (distTags) => ({
            ...distTags,
            [packageName]: { ...distTags[packageName], [tag]: version },
          }))
        }
      }),

    hasVersion: (packageName: string, version: string, options?: ViewOptions) =>
      Effect.gen(function* () {
        yield* record(state, { operation: 'hasVersion', packageName, version, options })
        if (yield* isHidden(packageName, version)) return false
        return yield* isPublished(packageName, version)
      }),

    observeVersion: (packageName: string, version: string, options?: ObserveVersionOptions) =>
      Effect.gen(function* () {
        yield* record(state, { operation: 'observeVersion', packageName, version, options })

        if (yield* isHidden(packageName, version)) {
          return yield* Effect.fail(viewError(`registry does not show ${packageName}@${version}`))
        }

        const receipts = yield* Ref.get(state.publishReceipts)
        const receipt = findLast(receipts, (candidate) =>
          receiptMatches(candidate, packageName, version),
        )
        const published = yield* Ref.get(state.published)
        const seeded = published[packageName]?.includes(version) ?? false

        if (receipt === undefined && !seeded) {
          return yield* Effect.fail(
            viewError(`registry has no publish receipt for ${packageName}@${version}`),
          )
        }

        const allDistTags = yield* Ref.get(state.distTags)
        const distTags =
          allDistTags[packageName] ??
          (receipt !== undefined ? { [receipt.tag]: version } : { latest: version })

        const tarballUrl = tarballUrlFor(options?.registry, packageName, version)

        const downloadedTarballSha256 =
          options?.downloadTarball === true && receipt !== undefined
            ? yield* sha256Hex(
                yield* fs.readFile(Fs.Path.toString(receipt.tarball)).pipe(
                  Effect.mapError(
                    (cause) =>
                      new NpmCliError({
                        context: {
                          operation: 'view',
                          detail: `failed to read tarball bytes for ${packageName}@${version}`,
                        },
                        cause: toError(cause),
                      }),
                  ),
                ),
              )
            : undefined

        return {
          versionMetadata: {
            name: packageName,
            version,
            dist: { tarball: tarballUrl },
          },
          distTags,
          tarballUrl,
          ...(downloadedTarballSha256 !== undefined ? { downloadedTarballSha256 } : {}),
        } satisfies RegistryVersionObservation
      }),

    listAccessPackages: (userOrScope: string, options?: AccessOptions) =>
      Effect.gen(function* () {
        yield* record(state, { operation: 'listAccessPackages', userOrScope, options })
        return yield* Ref.get(state.accessPackages)
      }),

    listAccessCollaborators: (packageName: string, options?: AccessOptions) =>
      Effect.gen(function* () {
        yield* record(state, { operation: 'listAccessCollaborators', packageName, options })
        return yield* Ref.get(state.accessCollaborators)
      }),

    getAccessStatus: (packageName: string, options?: AccessOptions) =>
      Effect.gen(function* () {
        yield* record(state, { operation: 'getAccessStatus', packageName, options })
        return yield* Ref.get(state.accessStatus)
      }),
  }
}

// ============================================================================
// Layers
// ============================================================================

/**
 * Create an in-memory NpmCli layer with the given configuration.
 *
 * Requires `FileSystem.FileSystem` (e.g. `Fs.Memory.layer` in tests).
 *
 * @example
 * ```ts
 * const layer = Memory.make({ published: { '@kitz/core': ['1.0.0'] } })
 *
 * const result = await Effect.runPromise(
 *   myEffect.pipe(Effect.provide(layer), Effect.provide(Fs.Memory.layer({ ... })))
 * )
 * ```
 */
export const make = (
  config: NpmCliMemoryConfig = {},
): Layer.Layer<NpmCli, never, FileSystem.FileSystem> =>
  Layer.effect(
    NpmCli,
    Effect.gen(function* () {
      const state = yield* makeState(config)
      const fs = yield* FileSystem.FileSystem
      return makeService(state, fs)
    }),
  )

/**
 * Create an in-memory NpmCli layer with access to mutable state.
 *
 * Useful for verifying operations, dynamically updating failure injection,
 * or inspecting final registry state after execution.
 *
 * @example
 * ```ts
 * const { layer, state } = await Effect.runPromise(Memory.makeWithState())
 *
 * await Effect.runPromise(myEffect.pipe(Effect.provide(layer), Effect.provide(fsLayer)))
 *
 * const published = await Effect.runPromise(Ref.get(state.published))
 * ```
 */
export const makeWithState = (
  config: NpmCliMemoryConfig = {},
): Effect.Effect<{
  layer: Layer.Layer<NpmCli, never, FileSystem.FileSystem>
  state: NpmCliMemoryState
}> =>
  Effect.gen(function* () {
    const state = yield* makeState(config)
    const layer = Layer.effect(
      NpmCli,
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem
        return makeService(state, fs)
      }),
    )
    return { layer, state }
  })

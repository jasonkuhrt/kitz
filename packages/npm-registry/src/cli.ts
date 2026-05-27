import { ChildProcess, ChildProcessSpawner } from 'effect/unstable/process'
import { createHash } from 'node:crypto'
import { Err } from '@kitz/core'
import { Fs } from '@kitz/fs'
import {
  Effect,
  Option,
  PlatformError,
  Record as EffectRecord,
  Result,
  Schema as S,
  Stream,
  String as Str,
} from 'effect'

// ============================================================================
// Errors
// ============================================================================

const baseTags = ['kit', 'npm-registry', 'cli'] as const

const NpmCliOperationSchema = S.Literals(['whoami', 'pack', 'publish', 'view', 'access'])
const ErrorCause = S.instanceOf(Error)
const NpmCliErrorContext = S.Struct({
  operation: NpmCliOperationSchema,
  detail: S.optional(S.String),
})

/**
 * npm CLI operation names for structured error context.
 */
export type NpmCliOperation = typeof NpmCliOperationSchema.Type

/**
 * npm CLI operation error.
 */
export const NpmCliError: Err.TaggedContextualErrorClass<
  'NpmCliError',
  typeof baseTags,
  typeof NpmCliErrorContext,
  typeof ErrorCause
> = Err.TaggedContextualError('NpmCliError', baseTags, {
  context: NpmCliErrorContext,
  message: (ctx) => `npm ${ctx.operation} failed${ctx.detail ? `: ${ctx.detail}` : ''}`,
  cause: ErrorCause,
})

export type NpmCliError = InstanceType<typeof NpmCliError>

// ============================================================================
// Options
// ============================================================================

/**
 * Options for npm whoami command.
 */
export interface WhoamiOptions {
  /** Registry URL (defaults to npm default) */
  readonly registry?: string
}

/**
 * Options for npm publish command.
 */
export type PackageManagerCli = 'npm' | 'pnpm' | 'bun'

export interface PublishOptions {
  /** Package manager CLI to invoke for pack/publish operations. */
  readonly packageManager?: PackageManagerCli
  /** Prepared tarball to publish */
  readonly tarball: Fs.Path.AbsFile
  /** npm dist-tag (default: 'latest') */
  readonly tag?: string
  /** Registry URL */
  readonly registry?: string
  /** npm access level (default: 'public') */
  readonly access?: 'public' | 'restricted'
  /** Disable lifecycle scripts during tarball publish (default: true) */
  readonly ignoreScripts?: boolean
  /** Simulate publish without mutating the registry. */
  readonly dryRun?: boolean
  /** One-time password for interactive local publishes. */
  readonly otp?: string
  /** Request npm provenance generation. */
  readonly provenance?: boolean
  /** Use a precomputed provenance bundle. */
  readonly provenanceFile?: Fs.Path.AbsFile
}

/**
 * Options for npm pack command.
 */
export interface PackOptions {
  /** Package manager CLI to invoke for pack/publish operations. */
  readonly packageManager?: PackageManagerCli
  /** Package directory to pack from */
  readonly cwd: Fs.Path.AbsDir
  /** Destination directory for the generated tarball */
  readonly packDestination: Fs.Path.AbsDir
  /** Explicit child environment for deterministic release packing. */
  readonly env?: Readonly<Record<string, string | undefined>>
}

/**
 * Result of `npm pack --json`.
 */
export interface PackFile {
  readonly path: string
  readonly size?: number | undefined
  readonly mode?: number | undefined
}

export interface PackResult {
  /** Full path to the tarball */
  readonly tarball: Fs.Path.AbsFile
  /** Filename reported by npm */
  readonly filename: string
  /** Files included in the tarball, when reported by npm. */
  readonly files?: readonly PackFile[] | undefined
  /** Tarball byte size, when reported by npm. */
  readonly size?: number | undefined
  /** npm sha1 shasum, when reported by npm. */
  readonly shasum?: string | undefined
  /** npm integrity value, when reported by npm. */
  readonly integrity?: string | undefined
}

/**
 * Options for npm view command.
 */
export interface ViewOptions {
  /** Registry URL (defaults to npm default) */
  readonly registry?: string
}

export interface ObserveVersionOptions extends ViewOptions {
  /** Download the registry tarball and compute SHA-256. */
  readonly downloadTarball?: boolean
}

export interface AccessOptions extends ViewOptions {}

export type AccessStatus = 'public' | 'restricted' | 'private' | 'unknown'

export interface RegistryVersionObservation {
  readonly versionMetadata: Readonly<Record<string, unknown>>
  readonly distTags: Readonly<Record<string, string>>
  readonly tarballUrl?: string
  readonly shasum?: string
  readonly integrity?: string
  readonly downloadedTarballSha256?: string
}

const NpmViewErrorSchema = S.Struct({
  error: S.Struct({
    code: S.String,
    summary: S.optional(S.String),
    detail: S.optional(S.String),
  }),
})

const decodeNpmViewError = S.decodeUnknownOption(S.fromJsonString(NpmViewErrorSchema))
const PackOutputEntrySchema = S.Struct({
  filename: S.String,
  files: S.optional(
    S.Array(
      S.Struct({
        path: S.String,
        size: S.optional(S.Number),
        mode: S.optional(S.Number),
      }),
    ),
  ),
  size: S.optional(S.Number),
  shasum: S.optional(S.String),
  integrity: S.optional(S.String),
})
type PackOutputEntry = typeof PackOutputEntrySchema.Type

const JsonPackOutputArraySchema = S.fromJsonString(S.Array(PackOutputEntrySchema))
const JsonPackOutputEntrySchema = S.fromJsonString(PackOutputEntrySchema)

const decodeJsonPackOutput = (
  output: string,
): Effect.Effect<readonly PackOutputEntry[], S.SchemaError> =>
  S.decodeUnknownEffect(JsonPackOutputArraySchema)(output).pipe(
    Effect.catch(() =>
      S.decodeUnknownEffect(JsonPackOutputEntrySchema)(output).pipe(
        Effect.map((entry): readonly PackOutputEntry[] => [entry]),
      ),
    ),
  )

const decodeBunPackOutput = (output: string): Effect.Effect<PackOutputEntry, Error> =>
  Effect.try({
    try: () => {
      const filename = output
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .at(-1)

      if (filename === undefined) throw new Error('bun pm pack returned no tarball path')
      return { filename }
    },
    catch: (cause) => (cause instanceof Error ? cause : new Error(String(cause))),
  })

const packOutputFor = (
  packageManager: PackageManagerCli,
  output: string,
): Effect.Effect<readonly PackOutputEntry[], Error | S.SchemaError> => {
  if (packageManager === 'bun') {
    return decodeBunPackOutput(output).pipe(
      Effect.map((entry): readonly PackOutputEntry[] => [entry]),
    )
  }

  return decodeJsonPackOutput(output)
}

const buildPackCommand = (options: PackOptions) => {
  const packDestination = Fs.Path.toString(options.packDestination)
  const packageManager = options.packageManager ?? 'npm'

  switch (packageManager) {
    case 'bun':
      return ChildProcess.make('bun', ['pm', 'pack', '--quiet', '--destination', packDestination], {
        cwd: Fs.Path.toString(options.cwd),
        ...(options.env !== undefined ? { env: { ...options.env }, extendEnv: false } : {}),
      })
    case 'pnpm':
      return ChildProcess.make('pnpm', ['pack', '--json', '--pack-destination', packDestination], {
        cwd: Fs.Path.toString(options.cwd),
        ...(options.env !== undefined ? { env: { ...options.env }, extendEnv: false } : {}),
      })
    case 'npm':
      return ChildProcess.make('npm', ['pack', '--json', '--pack-destination', packDestination], {
        cwd: Fs.Path.toString(options.cwd),
        ...(options.env !== undefined ? { env: { ...options.env }, extendEnv: false } : {}),
      })
  }
}

const tarballPathForPackEntry = (
  packDestination: Fs.Path.AbsDir,
  filename: string,
): Fs.Path.AbsFile =>
  filename.startsWith('/')
    ? Fs.Path.AbsFile.fromString(filename)
    : Fs.Path.join(packDestination, Fs.Path.RelFile.fromString(`./${filename}`))

const filenameForPackEntry = (filename: string): string => filename.split('/').at(-1) ?? filename

const buildPublishCommand = (options: PublishOptions) => {
  const tarball = Fs.Path.toString(options.tarball)
  const packageManager = options.packageManager ?? 'npm'

  switch (packageManager) {
    case 'bun':
      return ChildProcess.make('bun', [
        'publish',
        tarball,
        '--access',
        options.access ?? 'public',
        ...((options.ignoreScripts ?? true) ? ['--ignore-scripts'] : []),
        ...(options.tag ? ['--tag', options.tag] : []),
        ...(options.registry ? ['--registry', options.registry] : []),
        ...(options.otp ? ['--otp', options.otp] : []),
        ...(options.dryRun ? ['--dry-run'] : []),
      ])
    case 'pnpm':
      return ChildProcess.make('pnpm', [
        'publish',
        tarball,
        '--access',
        options.access ?? 'public',
        ...((options.ignoreScripts ?? true) ? ['--ignore-scripts'] : []),
        '--no-git-checks',
        ...(options.tag ? ['--tag', options.tag] : []),
        ...(options.registry ? ['--registry', options.registry] : []),
        ...(options.otp ? ['--otp', options.otp] : []),
        ...(options.provenance ? ['--provenance'] : []),
        ...(options.dryRun ? ['--dry-run'] : []),
      ])
    case 'npm':
      return ChildProcess.make('npm', [
        'publish',
        tarball,
        '--access',
        options.access ?? 'public',
        ...((options.ignoreScripts ?? true) ? ['--ignore-scripts'] : []),
        ...(options.tag ? ['--tag', options.tag] : []),
        ...(options.registry ? ['--registry', options.registry] : []),
        ...(options.otp ? ['--otp', options.otp] : []),
        ...(options.provenance ? ['--provenance'] : []),
        ...(options.provenanceFile !== undefined
          ? ['--provenance-file', Fs.Path.toString(options.provenanceFile)]
          : []),
        ...(options.dryRun ? ['--dry-run'] : []),
      ])
  }
}
const JsonRecordFromString = S.fromJsonString(S.Record(S.String, S.Unknown))
const decodeJsonRecord = S.decodeUnknownEffect(JsonRecordFromString)
const AccessStatusOutput = S.fromJsonString(
  S.Union([
    S.String,
    S.Struct({
      status: S.String,
    }),
    S.Struct({
      access: S.String,
    }),
  ]),
)
const decodeAccessStatusOutput = S.decodeUnknownEffect(AccessStatusOutput)

const readStreamString = (
  stream: Stream.Stream<Uint8Array, PlatformError.PlatformError>,
): Effect.Effect<string, PlatformError.PlatformError> =>
  stream.pipe(
    Stream.runCollect,
    Effect.map((chunks) => {
      const decoder = new TextDecoder()
      let output = ''
      for (const chunk of chunks) {
        output += decoder.decode(chunk, { stream: true })
      }
      output += decoder.decode()
      return output
    }),
  )

const sha256Bytes = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex')

const getNestedString = (
  object: Readonly<Record<string, unknown>>,
  key: string,
): string | undefined => {
  const value = object[key]
  return typeof value === 'string' ? value : undefined
}

const isObjectLike = (value: unknown): value is Readonly<Record<string, unknown>> =>
  value !== null && typeof value === 'object'

const stringValuesOnly = (
  record: Readonly<Record<string, unknown>>,
): Readonly<Record<string, string>> =>
  EffectRecord.filterMap(record, (value) =>
    typeof value === 'string' ? Result.succeed(value) : Result.failVoid,
  )

const readNpmViewJson = (
  args: readonly string[],
): Effect.Effect<
  Readonly<Record<string, unknown>>,
  NpmCliError,
  ChildProcessSpawner.ChildProcessSpawner
> =>
  Effect.scoped(
    Effect.gen(function* () {
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
      const command = ChildProcess.make('npm', [...args])
      const process = yield* command
      const { stdout, stderr, exitCode } = yield* Effect.all(
        {
          stdout: readStreamString(process.stdout),
          stderr: readStreamString(process.stderr),
          exitCode: process.exitCode,
        },
        { concurrency: 'unbounded' },
      )

      const stdoutText = Str.trim(stdout)
      const stderrText = Str.trim(stderr)

      if (Number(exitCode) === 0) {
        return yield* decodeJsonRecord(stdoutText).pipe(
          Effect.mapError(
            (cause) =>
              new NpmCliError({
                context: {
                  operation: 'view',
                  detail: 'npm view returned unexpected JSON output',
                },
                cause: cause instanceof Error ? cause : new Error(String(cause)),
              }),
          ),
        )
      }

      const parsed = decodeNpmViewError(stdoutText).pipe(
        Option.orElse(() => decodeNpmViewError(stderrText)),
      )
      const detail = Option.isSome(parsed)
        ? (parsed.value.error.summary ?? parsed.value.error.detail ?? 'npm view failed')
        : stdoutText || stderrText || `npm view exited with code ${String(exitCode)}`

      return yield* Effect.fail(
        new NpmCliError({
          context: { operation: 'view', detail },
          cause: new Error(detail),
        }),
      )
    }),
  ).pipe(
    Effect.mapError((cause) => {
      if (cause instanceof NpmCliError) return cause
      return new NpmCliError({
        context: {
          operation: 'view',
          detail: cause instanceof Error ? cause.message : 'npm view failed',
        },
        cause: cause instanceof Error ? cause : new Error(String(cause)),
      })
    }),
  )

const readNpmAccessJson = (
  args: readonly string[],
): Effect.Effect<
  Readonly<Record<string, unknown>>,
  NpmCliError,
  ChildProcessSpawner.ChildProcessSpawner
> =>
  Effect.scoped(
    Effect.gen(function* () {
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
      const command = ChildProcess.make('npm', [...args])
      const process = yield* command
      const { stdout, stderr, exitCode } = yield* Effect.all(
        {
          stdout: readStreamString(process.stdout),
          stderr: readStreamString(process.stderr),
          exitCode: process.exitCode,
        },
        { concurrency: 'unbounded' },
      )

      const stdoutText = Str.trim(stdout)
      const stderrText = Str.trim(stderr)

      if (Number(exitCode) === 0) {
        return yield* decodeJsonRecord(stdoutText).pipe(
          Effect.mapError(
            (cause) =>
              new NpmCliError({
                context: {
                  operation: 'access',
                  detail: 'npm access returned unexpected JSON output',
                },
                cause: cause instanceof Error ? cause : new Error(String(cause)),
              }),
          ),
        )
      }

      const parsed = decodeNpmViewError(stdoutText).pipe(
        Option.orElse(() => decodeNpmViewError(stderrText)),
      )
      const detail = Option.isSome(parsed)
        ? (parsed.value.error.summary ?? parsed.value.error.detail ?? 'npm access failed')
        : stdoutText || stderrText || `npm access exited with code ${String(exitCode)}`

      return yield* Effect.fail(
        new NpmCliError({
          context: { operation: 'access', detail },
          cause: new Error(detail),
        }),
      )
    }),
  ).pipe(
    Effect.mapError((cause) => {
      if (cause instanceof NpmCliError) return cause
      return new NpmCliError({
        context: {
          operation: 'access',
          detail: cause instanceof Error ? cause.message : 'npm access failed',
        },
        cause: cause instanceof Error ? cause : new Error(String(cause)),
      })
    }),
  )

// ============================================================================
// Public API
// ============================================================================

/**
 * Run `npm whoami` to get the authenticated npm username.
 *
 * @example
 * ```ts
 * const username = await Effect.runPromise(
 *   whoami().pipe(Effect.provide(ChildProcessSpawner.Default))
 * )
 * console.log(`Authenticated as ${username}`)
 * ```
 */
export function whoami(
  options?: WhoamiOptions,
): Effect.Effect<string, NpmCliError, ChildProcessSpawner.ChildProcessSpawner> {
  return Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
    const args = ['whoami']
    if (options?.registry) {
      args.push('--registry', options.registry)
    }

    const command = ChildProcess.make('npm', args)

    const result = yield* spawner.string(command).pipe(
      Effect.mapError(
        (cause) =>
          new NpmCliError({
            context: {
              operation: 'whoami',
              detail: "npm auth failed. Run 'npm login' to authenticate.",
            },
            cause: cause instanceof Error ? cause : new Error(String(cause)),
          }),
      ),
    )

    const username = Str.trim(result)

    if (!username) {
      return yield* Effect.fail(
        new NpmCliError({
          context: {
            operation: 'whoami',
            detail: 'npm whoami returned empty - check your npm authentication',
          },
          cause: new Error('npm whoami returned empty output'),
        }),
      )
    }

    return username
  })
}

/**
 * Run `npm pack` to create a publishable tarball.
 */
export function pack(
  options: PackOptions,
): Effect.Effect<PackResult, NpmCliError, ChildProcessSpawner.ChildProcessSpawner> {
  return Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
    const packageManager = options.packageManager ?? 'npm'
    const command = buildPackCommand(options)

    const output = yield* spawner.string(command).pipe(
      Effect.mapError(
        (cause) =>
          new NpmCliError({
            context: {
              operation: 'pack',
              detail: `${packageManager} pack failed while preparing a release artifact.`,
            },
            cause: cause instanceof Error ? cause : new Error(String(cause)),
          }),
      ),
    )

    const packEntries = yield* packOutputFor(packageManager, output).pipe(
      Effect.mapError(
        (cause) =>
          new NpmCliError({
            context: {
              operation: 'pack',
              detail:
                packageManager === 'bun'
                  ? 'bun pack returned unexpected output'
                  : `${packageManager} pack returned unexpected JSON output`,
            },
            cause: cause instanceof Error ? cause : new Error(String(cause)),
          }),
      ),
    )

    const entry = packEntries.at(-1)
    if (entry === undefined) {
      return yield* Effect.fail(
        new NpmCliError({
          context: {
            operation: 'pack',
            detail: 'npm pack returned no tarball metadata',
          },
          cause: new Error('npm pack returned no tarball metadata'),
        }),
      )
    }

    return {
      filename: filenameForPackEntry(entry.filename),
      ...(entry.files !== undefined ? { files: entry.files } : {}),
      ...(entry.size !== undefined ? { size: entry.size } : {}),
      ...(entry.shasum !== undefined ? { shasum: entry.shasum } : {}),
      ...(entry.integrity !== undefined ? { integrity: entry.integrity } : {}),
      tarball: tarballPathForPackEntry(options.packDestination, entry.filename),
    }
  })
}

/**
 * Run `npm publish` to publish a prepared tarball.
 *
 * @example
 * ```ts
 * await Effect.runPromise(
 *   publish({
 *     tarball: Fs.Path.AbsFile.fromString('/tmp/pkg-1.0.0.tgz'),
 *     tag: 'next',
 *   }).pipe(Effect.provide(ChildProcessSpawner.Default))
 * )
 * ```
 */
export function publish(
  options: PublishOptions,
): Effect.Effect<void, NpmCliError, ChildProcessSpawner.ChildProcessSpawner> {
  return Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
    const packageManager = options.packageManager ?? 'npm'
    const command = buildPublishCommand(options)

    yield* spawner.exitCode(command).pipe(
      Effect.flatMap((code) => {
        if (code !== 0) {
          return Effect.fail(
            new NpmCliError({
              context: {
                operation: 'publish',
                detail: `${packageManager} publish exited with code ${code}`,
              },
              cause: new Error(`${packageManager} publish exited with code ${code}`),
            }),
          )
        }
        return Effect.void
      }),
      Effect.mapError((cause) => {
        if (cause instanceof NpmCliError) return cause
        return new NpmCliError({
          context: { operation: 'publish' },
          cause: cause instanceof Error ? cause : new Error(String(cause)),
        })
      }),
    )
  })
}

/**
 * List packages visible to an npm user or scope through npm's access API.
 */
export function listAccessPackages(
  userOrScope: string,
  options?: AccessOptions,
): Effect.Effect<
  Readonly<Record<string, string>>,
  NpmCliError,
  ChildProcessSpawner.ChildProcessSpawner
> {
  const args = ['access', 'list', 'packages', userOrScope, '--json']
  if (options?.registry) args.push('--registry', options.registry)

  return readNpmAccessJson(args).pipe(Effect.map(stringValuesOnly))
}

/**
 * List collaborators for a package through npm's access API.
 */
export function listAccessCollaborators(
  packageName: string,
  options?: AccessOptions,
): Effect.Effect<
  Readonly<Record<string, string>>,
  NpmCliError,
  ChildProcessSpawner.ChildProcessSpawner
> {
  const args = ['access', 'list', 'collaborators', packageName, '--json']
  if (options?.registry) args.push('--registry', options.registry)

  return readNpmAccessJson(args).pipe(Effect.map(stringValuesOnly))
}

const normalizeAccessStatus = (value: unknown): AccessStatus => {
  if (value === 'public' || value === 'restricted' || value === 'private') return value
  return 'unknown'
}

/**
 * Read a package's access status through npm's access API.
 */
export function getAccessStatus(
  packageName: string,
  options?: AccessOptions,
): Effect.Effect<AccessStatus, NpmCliError, ChildProcessSpawner.ChildProcessSpawner> {
  return Effect.scoped(
    Effect.gen(function* () {
      const args = ['access', 'get', 'status', packageName, '--json']
      if (options?.registry) args.push('--registry', options.registry)

      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
      const command = ChildProcess.make('npm', args)
      const process = yield* command
      const { stdout, stderr, exitCode } = yield* Effect.all(
        {
          stdout: readStreamString(process.stdout),
          stderr: readStreamString(process.stderr),
          exitCode: process.exitCode,
        },
        { concurrency: 'unbounded' },
      )

      const stdoutText = Str.trim(stdout)
      const stderrText = Str.trim(stderr)

      if (Number(exitCode) === 0) {
        const output = yield* decodeAccessStatusOutput(stdoutText).pipe(
          Effect.mapError(
            (cause) =>
              new NpmCliError({
                context: {
                  operation: 'access',
                  detail: 'npm access get status returned unexpected JSON output',
                },
                cause: cause instanceof Error ? cause : new Error(String(cause)),
              }),
          ),
        )
        return typeof output === 'string'
          ? normalizeAccessStatus(output)
          : normalizeAccessStatus('status' in output ? output.status : output.access)
      }

      const parsed = decodeNpmViewError(stdoutText).pipe(
        Option.orElse(() => decodeNpmViewError(stderrText)),
      )
      const detail = Option.isSome(parsed)
        ? (parsed.value.error.summary ?? parsed.value.error.detail ?? 'npm access failed')
        : stdoutText || stderrText || `npm access exited with code ${String(exitCode)}`

      return yield* Effect.fail(new Error(detail))
    }),
  ).pipe(
    Effect.mapError((cause) => {
      if (cause instanceof NpmCliError) return cause
      return new NpmCliError({
        context: {
          operation: 'access',
          detail:
            cause instanceof Error && cause.message
              ? cause.message
              : `npm access get status ${packageName} failed`,
        },
        cause: cause instanceof Error ? cause : new Error(String(cause)),
      })
    }),
  )
}

/**
 * Check whether an exact package version already exists in the registry.
 *
 * Returns `false` for npm `E404` (package or version not found), and fails for
 * other npm view errors so callers can distinguish registry outages from a
 * truly unpublished version.
 */
export function hasVersion(
  packageName: string,
  version: string,
  options?: ViewOptions,
): Effect.Effect<boolean, NpmCliError, ChildProcessSpawner.ChildProcessSpawner> {
  return Effect.scoped(
    Effect.gen(function* () {
      const args = ['--silent', 'view', `${packageName}@${version}`, 'version', '--json']
      if (options?.registry) {
        args.push('--registry', options.registry)
      }

      const command = ChildProcess.make('npm', args)
      const process = yield* command
      const { stdout, stderr, exitCode } = yield* Effect.all(
        {
          stdout: readStreamString(process.stdout),
          stderr: readStreamString(process.stderr),
          exitCode: process.exitCode,
        },
        { concurrency: 'unbounded' },
      )

      if (Number(exitCode) === 0) {
        return true
      }

      const stdoutText = Str.trim(stdout)
      const stderrText = Str.trim(stderr)
      const parsed = decodeNpmViewError(stdoutText).pipe(
        Option.orElse(() => decodeNpmViewError(stderrText)),
      )

      if (Option.isSome(parsed) && parsed.value.error.code === 'E404') {
        return false
      }

      const detail = Option.isSome(parsed)
        ? (parsed.value.error.summary ?? parsed.value.error.detail ?? 'npm view failed')
        : stdoutText || stderrText || `npm view exited with code ${String(exitCode)}`

      return yield* Effect.fail(new Error(detail))
    }),
  ).pipe(
    Effect.mapError((cause) => {
      if (cause instanceof NpmCliError) return cause
      return new NpmCliError({
        context: {
          operation: 'view',
          detail:
            cause instanceof Error && cause.message
              ? cause.message
              : `npm view ${packageName}@${version} failed`,
        },
        cause: cause instanceof Error ? cause : new Error(String(cause)),
      })
    }),
  )
}

/**
 * Read exact registry metadata for a package version and its package dist-tags.
 */
export function observeVersion(
  packageName: string,
  version: string,
  options?: ObserveVersionOptions,
): Effect.Effect<RegistryVersionObservation, NpmCliError, ChildProcessSpawner.ChildProcessSpawner> {
  return Effect.gen(function* () {
    const versionArgs = ['--silent', 'view', `${packageName}@${version}`, '--json']
    const distTagArgs = ['--silent', 'view', packageName, 'dist-tags', '--json']
    if (options?.registry) {
      versionArgs.push('--registry', options.registry)
      distTagArgs.push('--registry', options.registry)
    }

    const versionMetadata = yield* readNpmViewJson(versionArgs)
    const distTagsJson = yield* readNpmViewJson(distTagArgs)
    const distTags = stringValuesOnly(distTagsJson)
    const dist = versionMetadata['dist']
    const distRecord = isObjectLike(dist) ? dist : {}
    const tarballUrl = getNestedString(distRecord, 'tarball')
    const shasum = getNestedString(distRecord, 'shasum')
    const integrity = getNestedString(distRecord, 'integrity')

    const downloadedTarballSha256 =
      options?.downloadTarball === true && tarballUrl !== undefined
        ? yield* Effect.tryPromise({
            try: async () => {
              const response = await fetch(tarballUrl)
              if (!response.ok) {
                throw new Error(`tarball download failed with HTTP ${response.status}`)
              }
              return sha256Bytes(new Uint8Array(await response.arrayBuffer()))
            },
            catch: (cause) =>
              new NpmCliError({
                context: {
                  operation: 'view',
                  detail:
                    cause instanceof Error
                      ? cause.message
                      : `failed to download registry tarball for ${packageName}@${version}`,
                },
                cause: cause instanceof Error ? cause : new Error(String(cause)),
              }),
          })
        : undefined

    return {
      versionMetadata,
      distTags,
      ...(tarballUrl !== undefined ? { tarballUrl } : {}),
      ...(shasum !== undefined ? { shasum } : {}),
      ...(integrity !== undefined ? { integrity } : {}),
      ...(downloadedTarballSha256 !== undefined ? { downloadedTarballSha256 } : {}),
    }
  })
}

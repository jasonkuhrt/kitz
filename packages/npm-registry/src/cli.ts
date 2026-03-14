import { ChildProcess, ChildProcessSpawner } from 'effect/unstable/process'
import type { PlatformError } from 'effect/PlatformError'
import { Err } from '@kitz/core'
import { Fs } from '@kitz/fs'
import { Effect, Option, Schema as S, Stream, String as Str } from 'effect'

// ============================================================================
// Errors
// ============================================================================

const baseTags = ['kit', 'npm-registry', 'cli'] as const

const NpmCliOperationSchema = S.Literals(['whoami', 'pack', 'publish', 'view'])
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
export interface PublishOptions {
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
}

/**
 * Options for npm pack command.
 */
export interface PackOptions {
  /** Package directory to pack from */
  readonly cwd: Fs.Path.AbsDir
  /** Destination directory for the generated tarball */
  readonly packDestination: Fs.Path.AbsDir
}

/**
 * Result of `npm pack --json`.
 */
export interface PackResult {
  /** Full path to the tarball */
  readonly tarball: Fs.Path.AbsFile
  /** Filename reported by npm */
  readonly filename: string
}

/**
 * Options for npm view command.
 */
export interface ViewOptions {
  /** Registry URL (defaults to npm default) */
  readonly registry?: string
}

const NpmViewErrorSchema = S.Struct({
  error: S.Struct({
    code: S.String,
    summary: S.optional(S.String),
    detail: S.optional(S.String),
  }),
})

const decodeNpmViewError = S.decodeUnknownOption(S.fromJsonString(NpmViewErrorSchema))
const NpmPackOutputSchema = S.fromJsonString(
  S.Array(
    S.Struct({
      filename: S.String,
    }),
  ),
)
const decodeNpmPackOutput = S.decodeUnknownEffect(NpmPackOutputSchema)

const readStreamString = (
  stream: Stream.Stream<Uint8Array, PlatformError>,
): Effect.Effect<string, PlatformError> =>
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
    const args = ['pack', '--json', '--pack-destination', Fs.Path.toString(options.packDestination)]

    const command = ChildProcess.make('npm', args, {
      cwd: Fs.Path.toString(options.cwd),
    })

    const output = yield* spawner.string(command).pipe(
      Effect.mapError(
        (cause) =>
          new NpmCliError({
            context: {
              operation: 'pack',
              detail: 'npm pack failed while preparing a release artifact.',
            },
            cause: cause instanceof Error ? cause : new Error(String(cause)),
          }),
      ),
    )

    const packEntries = yield* decodeNpmPackOutput(output).pipe(
      Effect.mapError(
        (cause) =>
          new NpmCliError({
            context: {
              operation: 'pack',
              detail: 'npm pack returned unexpected JSON output',
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
      filename: entry.filename,
      tarball: Fs.Path.join(
        options.packDestination,
        Fs.Path.RelFile.fromString(`./${entry.filename}`),
      ),
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
    const args = ['publish', Fs.Path.toString(options.tarball)]

    // Default to public access for scoped packages
    args.push('--access', options.access ?? 'public')

    if (options.ignoreScripts ?? true) {
      args.push('--ignore-scripts')
    }

    if (options.tag) {
      args.push('--tag', options.tag)
    }

    if (options.registry) {
      args.push('--registry', options.registry)
    }

    const command = ChildProcess.make('npm', args)

    yield* spawner.exitCode(command).pipe(
      Effect.flatMap((code) => {
        if (code !== 0) {
          return Effect.fail(
            new NpmCliError({
              context: {
                operation: 'publish',
                detail: `npm publish exited with code ${code}`,
              },
              cause: new Error(`npm publish exited with code ${code}`),
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

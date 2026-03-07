import { Command, CommandExecutor } from '@effect/platform'
import type { PlatformError } from '@effect/platform/Error'
import { Err } from '@kitz/core'
import { Fs } from '@kitz/fs'
import { Effect, Option, Schema as S, Stream, String as Str } from 'effect'

// ============================================================================
// Errors
// ============================================================================

const baseTags = ['kit', 'npm-registry', 'cli'] as const

const NpmCliOperationSchema = S.Literal('whoami', 'publish', 'view')
const ErrorCause = S.instanceOf(Error)
const NpmCliErrorContext = S.Struct({
  operation: NpmCliOperationSchema,
  detail: S.optional(S.String),
})

/**
 * npm CLI operation names for structured error context.
 */
export type NpmCliOperation = S.Schema.Type<typeof NpmCliOperationSchema>

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
  /** Package directory to publish from */
  readonly cwd: Fs.Path.AbsDir
  /** npm dist-tag (default: 'latest') */
  readonly tag?: string
  /** Registry URL */
  readonly registry?: string
  /** npm access level (default: 'public') */
  readonly access?: 'public' | 'restricted'
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

const decodeNpmViewError = S.decodeUnknownOption(S.parseJson(NpmViewErrorSchema))

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
 *   whoami().pipe(Effect.provide(CommandExecutor.layer))
 * )
 * console.log(`Authenticated as ${username}`)
 * ```
 */
export function whoami(
  options?: WhoamiOptions,
): Effect.Effect<string, NpmCliError, CommandExecutor.CommandExecutor> {
  return Effect.gen(function* () {
    const args = ['whoami']
    if (options?.registry) {
      args.push('--registry', options.registry)
    }

    const command = Command.make('npm', ...args)

    const result = yield* Command.string(command).pipe(
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
 * Run `npm publish` to publish a package.
 *
 * @example
 * ```ts
 * await Effect.runPromise(
 *   publish({
 *     cwd: Fs.Path.AbsDir.fromString('/path/to/package'),
 *     tag: 'next',
 *   }).pipe(Effect.provide(CommandExecutor.layer))
 * )
 * ```
 */
export function publish(
  options: PublishOptions,
): Effect.Effect<void, NpmCliError, CommandExecutor.CommandExecutor> {
  return Effect.gen(function* () {
    const args = ['publish']

    // Default to public access for scoped packages
    args.push('--access', options.access ?? 'public')

    if (options.tag) {
      args.push('--tag', options.tag)
    }

    if (options.registry) {
      args.push('--registry', options.registry)
    }

    const command = Command.make('npm', ...args).pipe(
      Command.workingDirectory(Fs.Path.toString(options.cwd)),
    )

    yield* Command.exitCode(command).pipe(
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
): Effect.Effect<boolean, NpmCliError, CommandExecutor.CommandExecutor> {
  return Effect.scoped(
    Effect.gen(function* () {
      const args = ['--silent', 'view', `${packageName}@${version}`, 'version', '--json']
      if (options?.registry) {
        args.push('--registry', options.registry)
      }

      const command = Command.make('npm', ...args)
      const process = yield* Command.start(command)
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
        ? parsed.value.error.summary ?? parsed.value.error.detail ?? 'npm view failed'
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

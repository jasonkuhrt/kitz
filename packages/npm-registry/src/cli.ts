import { Command, CommandExecutor } from '@effect/platform'
import { Err } from '@kitz/core'
import { Fs } from '@kitz/fs'
import { Effect, Schema as S, String as Str } from 'effect'

// ============================================================================
// Errors
// ============================================================================

const baseTags = ['kit', 'npm-registry', 'cli'] as const

const NpmCliOperationSchema = S.Literal('whoami', 'publish')

/**
 * npm CLI operation names for structured error context.
 */
export type NpmCliOperation = S.Schema.Type<typeof NpmCliOperationSchema>

/**
 * npm CLI operation error.
 */
export const NpmCliError = Err.TaggedContextualError(
  'NpmCliError',
  baseTags,
  {
    context: S.Struct({
      operation: NpmCliOperationSchema,
      detail: S.optional(S.String),
    }),
    message: (ctx) => `npm ${ctx.operation} failed${ctx.detail ? `: ${ctx.detail}` : ''}`,
    cause: S.instanceOf(Error),
  },
)

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
export const whoami = (
  options?: WhoamiOptions,
): Effect.Effect<string, NpmCliError, CommandExecutor.CommandExecutor> =>
  Effect.gen(function*() {
    const args = ['whoami']
    if (options?.registry) {
      args.push('--registry', options.registry)
    }

    const command = Command.make('npm', ...args)

    const result = yield* Command.string(command).pipe(
      Effect.mapError((cause) =>
        new NpmCliError({
          context: {
            operation: 'whoami',
            detail: "npm auth failed. Run 'npm login' to authenticate.",
          },
          cause: cause instanceof Error ? cause : new Error(String(cause)),
        })
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
        }),
      )
    }

    return username
  })

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
export const publish = (
  options: PublishOptions,
): Effect.Effect<void, NpmCliError, CommandExecutor.CommandExecutor> =>
  Effect.gen(function*() {
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

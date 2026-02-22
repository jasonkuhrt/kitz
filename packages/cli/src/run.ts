import { NodeRuntime } from '@effect/platform-node'
import { Err } from '@kitz/core'
import { Cause, Effect, Exit, Layer } from 'effect'

/**
 * Options for {@link run}.
 */
export interface RunOptions {
  /**
   * Custom error handler. Called when the program fails.
   * Default logs error with rich formatting via {@link Err.logUnsafe} and exits with code 1.
   */
  onError?: (cause: Cause.Cause<unknown>) => void
}

/**
 * Run an Effect program as an entry point.
 *
 * Curried, data-last API: provide the layer first, then the program.
 * This enables piping and trailing function style.
 *
 * Features:
 * - Provides the layer to the program
 * - Handles SIGINT with graceful teardown
 * - Logs errors with rich formatting (colors, cleaned stack traces, context, nested errors)
 * - Sets exit code 1 on failure, 0 on success
 *
 * Works on both Node.js and Bun runtimes.
 *
 * @example
 * ```ts
 * import { Cli } from '@kitz/cli'
 * import { Effect, Layer } from 'effect'
 *
 * // Trailing function style (inline program)
 * Cli.run(Layer.mergeAll(Env.Live, NodeFileSystem.layer))(
 *   Effect.gen(function*() {
 *     // ... your program logic
 *   })
 * )
 * ```
 *
 * @example
 * ```ts
 * // With a named program
 * const program = Effect.gen(function*() {
 *   // ... your program logic
 * })
 *
 * const layers = Layer.mergeAll(Env.Live, NodeFileSystem.layer)
 *
 * Cli.run(layers)(program)
 * ```
 *
 * @example
 * ```ts
 * // Piped style
 * import { pipe } from 'effect'
 *
 * pipe(
 *   Effect.gen(function*() {
 *     // ... your program logic
 *   }),
 *   Cli.run(layers)
 * )
 * ```
 *
 * @example
 * ```ts
 * // Custom error handling
 * Cli.run(layers, {
 *   onError: (cause) => {
 *     // Custom handling for specific errors
 *     if (Cause.isFailure(cause)) {
 *       const error = Cause.failureOption(cause)
 *       // ... handle specific error types
 *     }
 *     // Fall back to default formatting
 *     Err.logUnsafe(Err.ensure(Cause.squash(cause)))
 *     process.exit(1)
 *   }
 * })(program)
 * ```
 */
export const run = <R, E2>(
  layer: Layer.Layer<R, E2, never>,
  options?: RunOptions,
) =>
<A, E>(
  program: Effect.Effect<A, E, R>,
): void => {
  NodeRuntime.runMain(
    Effect.provide(program, layer),
    {
      disableErrorReporting: true,
      teardown: (exit, onExit) => {
        if (Exit.isFailure(exit)) {
          const handler = options?.onError ?? defaultErrorHandler
          handler(exit.cause)
        }
        onExit(Exit.isFailure(exit) ? 1 : 0)
      },
    },
  )
}

const defaultErrorHandler = (cause: Cause.Cause<unknown>): void => {
  Err.logUnsafe(Err.ensure(Cause.squash(cause)))
}

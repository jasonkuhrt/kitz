import { Arr, Str } from '@kitz/core'
import { SchemaGetter, Schema as S } from 'effect'

// ============================================
// Process Argv
// ============================================

/**
 * Usually there is a second element too, the script that was executed, but not always.
 * For example in NodeJS REPL it would be missing.
 */
export type ProcessArgv = readonly [string, ...string[]]

const createProcessArgv = (
  execPath: string,
  scriptPath: null | string,
  args: readonly string[],
): ProcessArgv => {
  return scriptPath === null ? [execPath, ...args] : [execPath, scriptPath, ...args]
}

/**
 * Schema for process argv - a non-empty array of strings.
 */
export const ProcessArgvSchema = S.NonEmptyArray(S.String)

/**
 * Type guard to check if a value is a valid process argv array.
 *
 * Validates that the value is an array with at least one element (the executable path)
 * and that all elements are strings.
 *
 * @param value - The value to check
 * @returns true if the value is a valid ProcessArgv array
 *
 * @example
 * isProcessArgvLoose(['node', 'script.js', '--flag']) // true
 * isProcessArgvLoose(['node']) // true (valid in REPL)
 * isProcessArgvLoose([]) // false (no executable path)
 * isProcessArgvLoose(['node', 123]) // false (non-string element)
 */
export const isProcessArgvLoose = (value: unknown): value is ProcessArgv => {
  return Arr.is(value) && value.length >= 1 && value.every(Str.is)
}

// ============================================
// Argv
// ============================================

/**
 * Structured representation of parsed process argv.
 */
export interface Argv {
  readonly execPath: string
  /**
   * Not present for example when in a NodeJS REPL.
   */
  readonly scriptPath: null | string
  readonly args: readonly string[]
}

/**
 * Schema that transforms raw process argv into a structured {@link Argv} object.
 *
 * @example
 * ```ts
 * import { Schema } from 'effect'
 *
 * // Decode raw argv
 * const argv = Schema.decodeUnknownSync(ArgvSchema)(['node', 'script.js', '--verbose'])
 * // { execPath: 'node', scriptPath: 'script.js', args: ['--verbose'] }
 * ```
 */
export const ArgvSchema: S.Codec<Argv, ProcessArgv> = ProcessArgvSchema.pipe(
  S.decodeTo(
    S.Struct({
      execPath: S.String,
      scriptPath: S.NullOr(S.String),
      args: S.Array(S.String),
    }),
    {
      decode: SchemaGetter.transform(([execPath, scriptPath = null, ...args]) => ({
        execPath,
        scriptPath,
        args,
      })),
      encode: SchemaGetter.transform(({ execPath, scriptPath, args }) =>
        createProcessArgv(execPath, scriptPath, args),
      ),
    },
  ),
)

/**
 * Parse unknown value into a structured {@link Argv}.
 *
 * Returns an Effect that can be yielded in Effect.gen blocks.
 *
 * @example
 * ```ts
 * import { Effect } from 'effect'
 *
 * const program = Effect.gen(function*() {
 *   const argv = yield* parseArgv(process.argv)
 *   console.log(argv.execPath, argv.args)
 * })
 * ```
 *
 * @example
 * ```ts
 * // Normal CLI execution
 * parseArgv(['node', 'script.js', '--verbose', 'input.txt'])
 * // Effect resolving to:
 * // { execPath: 'node', scriptPath: 'script.js', args: ['--verbose', 'input.txt'] }
 * ```
 *
 * @example
 * ```ts
 * // REPL execution (no script path)
 * parseArgv(['node'])
 * // Effect resolving to:
 * // { execPath: 'node', scriptPath: null, args: [] }
 * ```
 */
export const parseArgv = S.decodeUnknownEffect(ArgvSchema)

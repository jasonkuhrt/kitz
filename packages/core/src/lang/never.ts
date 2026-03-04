/* eslint-disable kitz/no-throw -- This file IS the centralized throw point for defects. */

/**
 * Signal a defect — an impossible state that indicates a bug in the code.
 *
 * This is the plain-context equivalent of `Effect.die()`. All defect throws
 * in the codebase should go through this function so that:
 * 1. Intent is explicit (defect, not domain error)
 * 2. The `no-throw` lint rule only needs to allowlist this one file
 *
 * Uses `Error.captureStackTrace` to remove `panic` from the stack trace,
 * so the top frame points to the actual call site rather than this utility.
 *
 * @example
 * ```ts
 * panic('Unexpected null in pipeline')
 * panic('Invalid state', { phase: 'init', value })
 * ```
 */
export const panic = (message: string, cause?: unknown): never => {
  const error = new Error(message, { cause })
  if (Error.captureStackTrace) {
    Error.captureStackTrace(error, panic)
  }
  throw error
}

/**
 * Exhaustive check — signals that a switch/if-else chain failed to cover
 * all cases. TypeScript narrows the value to `never` at this point, so
 * if this function is reachable, a case was missed.
 *
 * @example
 * ```ts
 * switch (status) {
 *   case 'active': return handle()
 *   case 'inactive': return skip()
 *   default: neverCase(status) // TS error if a case is missing
 * }
 * ```
 */
export const neverCase = (value: never): never => panic(`Exhaustive check failed`, { value })

/**
 * Mark a code path as not yet implemented.
 *
 * @example
 * ```ts
 * const result = todo<string>('implement parser')
 * ```
 */
export const todo = <type>(message?: string): type => panic(`todo${message ? `: ${message}` : ''}`)

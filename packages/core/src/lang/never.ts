/* eslint-disable kitz/no-throw -- This file IS the centralized throw point for all throws. */

//
// All functions in this file use `const` bindings with explicit call-signature
// type annotations. This is required for TypeScript's control flow analysis
// (CFA) to recognize calls as `never`-returning and narrow types after guard
// checks like:
//
//   if (x === null) Lang.panic('...')
//   x // narrowed to non-null
//
// Two patterns trigger CFA narrowing:
//   ✅ function panic(msg: string): never { ... }
//   ✅ const panic: (msg: string) => never = ...
//
// This common pattern does NOT:
//   ❌ const panic = (msg: string): never => { ... }
//
// The distinction is where the `never` annotation lives: on the binding's
// declared type (works) vs. on the arrow's return position (doesn't work).
//

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
export const panic: (message: string, cause?: unknown) => never = (message, cause) => {
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
export const neverCase: (value: never) => never = (value) => {
  return panic(`Exhaustive check failed`, { value })
}

/**
 * Mark a code path as not yet implemented.
 *
 * @example
 * ```ts
 * const result = todo<string>('implement parser')
 * ```
 */
export const todo: <type>(message?: string) => type = (message) => {
  return panic(`todo${message ? `: ${message}` : ''}`)
}

/**
 * Throw any value. Use for bridge/adapter code that needs to
 * re-throw existing errors or throw specific error types.
 *
 * Unlike {@link panic}, this doesn't construct a new Error or
 * strip the stack trace — it throws the value as-is.
 *
 * @example
 * ```ts
 * Lang.throw(result.left)
 * Lang.throw(new TypeError('Expected array'))
 * ```
 */
const throw_: (error: unknown) => never = (error) => {
  throw error
}
export { throw_ as throw }

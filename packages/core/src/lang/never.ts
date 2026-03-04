/**
 * Signal a defect — an impossible state that indicates a bug in the code.
 *
 * This is the plain-context equivalent of `Effect.die()`. All defect throws
 * in the codebase should go through this function so that:
 * 1. Intent is explicit (defect, not domain error)
 * 2. The `no-throw` lint rule only needs to allowlist this one file
 *
 * @example
 * ```ts
 * // Generic defect
 * die('Unexpected null in pipeline')
 *
 * // With structured cause for debugging
 * die('Invalid state', { phase: 'init', value })
 * ```
 */
export const die = (message: string, cause?: unknown): never => {
  throw new Error(message, { cause })
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
 *   default: absurd(status) // TS error if a case is missing
 * }
 * ```
 */
export const absurd = (value: never): never => die(`Exhaustive check failed`, { value })

/**
 * Mark a code path as not yet implemented.
 *
 * @example
 * ```ts
 * const result = todo<string>('implement parser')
 * ```
 */
export const todo = <type>(message?: string): type => die(`todo${message ? `: ${message}` : ''}`)

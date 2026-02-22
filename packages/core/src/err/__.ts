import { Fn } from '#fn'
import { Effect } from 'effect'
import { inspect, type InspectOptions } from './inspect.js'

export * from './contextual.js'

export * from './internal.js'

export * from './aggregate.js'

export * from './inspect.js'

export * from './stack.js'

export * from './try.js'

export * from './type.js'

export * from './types.js'

export * from './wrap.js'

/**
 * Log an error to console with nice formatting.
 *
 * Effect-native version that returns an Effect for composition in pipelines.
 *
 * @see {@link logUnsafe} for immediate execution outside Effect context
 *
 * @category Inspection
 */
export const log = (error: Error, options?: InspectOptions): Effect.Effect<void> =>
  Effect.sync(() => console.log(inspect(error, options)))

/**
 * Log an error to console with nice formatting.
 *
 * Immediate execution version for use outside Effect context (CLI scripts, etc).
 * "Unsafe" means it bypasses Effect's supervision - the side effect runs immediately.
 *
 * @see {@link log} for Effect-native version
 *
 * @category Inspection
 */
export const logUnsafe = (error: Error, options?: InspectOptions): void => {
  console.log(inspect(error, options))
}

/**
 * Throw an error if the value is null, otherwise return the non-null value.
 * @param value - The value to check
 * @param message - Optional custom error message
 * @returns The value if not null
 * @throws Error if the value is null
 * @example
 * ```ts
 * const result = throwNull(maybeNull) // throws if null
 * const safe = throwNull(maybeNull, 'Custom error message')
 * ```
 *
 * @category Utilities
 */
export const throwNull = <V>(value: V, message?: string): Exclude<V, null> => {
  if (value === null) throw new Error(message ?? defaultThrowNullMessage)

  return value as any
}

/**
 * Default error message used by {@link throwNull} when no custom message is provided.
 *
 * @category Utilities
 */
export const defaultThrowNullMessage = 'Unexpected null value.'

/**
 * Wrap a function to throw an error if it returns null.
 * @param fn - The function to wrap
 * @param message - Optional custom error message when null is returned
 * @returns A wrapped function that throws on null return values
 * @example
 * ```ts
 * const find = (id: string) => items.find(item => item.id === id) ?? null
 * const findOrThrow = guardNull(find, 'Item not found')
 *
 * const item = findOrThrow('123') // throws if not found
 * ```
 *
 * @category Utilities
 */
export const guardNull = <fn extends Fn.AnyAny>(
  fn: fn,
  /**
   * The message to use when a null value is encountered.
   */
  message?: string,
): Fn.ReturnExcludeNull<fn> => {
  // @ts-expect-error
  return (...args) => {
    const result = fn(...args)
    return throwNull(result, message)
  }
}

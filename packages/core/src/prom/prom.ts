import { Lang } from '#lang'
// import { isShape as Obj_isShape } from '#obj/obj' // Temporarily disabled for migration

/**
 * Type representing a Promise of unknown type.
 * Useful for generic promise handling where the resolved type is not important.
 *
 * @category Types
 */
export type Any = Promise<unknown>

/**
 * Type representing a Promise of any type.
 * Less type-safe than {@link Any}, use with caution.
 *
 * @category Types
 */
export type AnyAny = Promise<any>

/**
 * Type representing a value that may or may not be wrapped in a Promise.
 *
 * @example
 * ```ts
 * // function that accepts sync or async values
 * function process<T>(value: Maybe<T>): Promise<T> {
 *   return Promise.resolve(value)
 * }
 *
 * process(42) // accepts number
 * process(Promise.resolve(42)) // accepts Promise<number>
 * ```
 *
 * @category Types
 */
export type Maybe<$Type> = $Type | Promise<$Type>

/**
 * Check if a value has the shape of a Promise.
 * Tests for the presence of then, catch, and finally methods.
 *
 * @param value - The value to test.
 * @returns True if the value has Promise-like shape.
 *
 * @example
 * ```ts
 * // with a promise
 * isShape(Promise.resolve(42)) // true
 *
 * // with a thenable object
 * isShape({ then: () => {}, catch: () => {}, finally: () => {} }) // true
 *
 * // with non-promise values
 * isShape(42) // false
 * isShape({}) // false
 * ```
 *
 * @category Type Guards
 */
export const isShape = (value: unknown): value is AnyAny => {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as any).then === 'function' &&
    typeof (value as any).catch === 'function' &&
    typeof (value as any).finally === 'function'
  )
}

/**
 * Type that adds an additional type to a potentially promised union.
 * If the input is a Promise, the additional type is added to the promised value.
 * If the input is not a Promise, creates a union with the additional type.
 *
 * @example
 * ```ts
 * // with promise input
 * type Result1 = AwaitedUnion<Promise<string>, number> // Promise<string | number>
 *
 * // with non-promise input
 * type Result2 = AwaitedUnion<string, number> // string | number
 * ```
 *
 * @category Types
 */
// oxfmt-ignore
export type AwaitedUnion<$MaybePromise, $Additional> =
  $MaybePromise extends Promise<infer __promised__>
    ? Promise<Awaited<__promised__ | $Additional>>
    : $MaybePromise | $Additional

/**
 * Envelope containing execution metadata.
 *
 * @category Types
 */
export type Envelope<T = unknown> = {
  fail: boolean
  value: T
  async: boolean
}

/**
 * Execute a function and return an envelope with metadata about the execution.
 *
 * Returns metadata indicating:
 * - **channel**: Whether the function succeeded (`'succeed'`) or failed (`'fail'`)
 * - **async**: Whether execution was asynchronous (promise) or synchronous
 * - **value/error**: The result value or thrown/rejected error
 *
 * Never throws or rejects - all errors are captured in the envelope.
 * Preserves sync/async distinction in both return type and metadata.
 *
 * Useful when you need to:
 * - Distinguish `Promise.resolve(Error)` from `Promise.reject(Error)`
 * - Know whether execution was sync or async
 * - Handle errors without try/catch blocks
 *
 * @param fn - Function to execute
 * @returns Envelope (sync) or Promise of envelope (async) with execution metadata
 *
 * @example
 * ```ts
 * // Sync success
 * const result = maybeAsyncEnvelope(() => 42)
 * // { channel: 'succeed', value: 42, async: false }
 *
 * // Sync failure
 * const result = maybeAsyncEnvelope(() => { throw new Error('fail') })
 * // { channel: 'fail', error: Error('fail'), async: false }
 *
 * // Async success
 * const result = await maybeAsyncEnvelope(() => Promise.resolve('ok'))
 * // { channel: 'succeed', value: 'ok', async: true }
 *
 * // Async failure
 * const result = await maybeAsyncEnvelope(() => Promise.reject('error'))
 * // { channel: 'fail', error: 'error', async: true }
 *
 * // Promise resolving to Error (not a rejection!)
 * const result = await maybeAsyncEnvelope(() => Promise.resolve(new Error('value')))
 * // { channel: 'succeed', value: Error('value'), async: true }
 * ```
 *
 * @category Utilities
 */
// oxfmt-ignore
export const maybeAsyncEnvelope = <$return>(fn: () => $return):
  $return extends Promise<infer __awaited__>
    ? Promise<Envelope<__awaited__>>
    : Envelope<$return> => {
  try {
    const result = fn()

    if (isShape(result)) {
      // Async path - return promise of envelope
      return result
        .then((value) => ({ fail: false, value, async: true }))
        .catch((value) => ({ fail: true, value, async: true })) as any
    }

    // Sync success path - return envelope directly
    return { fail: false, value: result, async: false } as any
  } catch (value) {
    // Sync failure path - return envelope directly
    return { fail: true, value, async: false } as any
  }
}

/**
 * Options for handling values that might be promises.
 *
 * @category Utilities
 */
export interface MaybeAsyncHandlers<T, R = T, E = unknown> {
  /**
   * Handler for successful values (sync or async).
   */
  then?: (value: T) => R

  /**
   * Handler for errors (sync or async).
   * @param error - The caught error
   * @param isAsync - Whether the error occurred asynchronously
   */
  catch?: (error: unknown, isAsync: boolean) => E
}

/**
 * Handle a function that might return a promise or a regular value,
 * with unified handlers for both sync and async cases.
 *
 * Implemented using {@link maybeAsyncEnvelope} internally.
 *
 * @param fn - Function to execute that might return a promise
 * @param handlers - Object with then/catch handlers
 * @returns The result, potentially wrapped in a Promise
 *
 * @example
 * ```ts
 * // Basic usage
 * const result = maybeAsync(
 *   () => fetchData(),
 *   {
 *     then: (data) => processData(data),
 *     catch: (error) => ({ success: false, error })
 *   }
 * )
 *
 * // Just error handling
 * const safeResult = maybeAsync(
 *   () => riskyOperation(),
 *   {
 *     catch: (error, isAsync) => {
 *       console.error(`Failed ${isAsync ? 'async' : 'sync'}:`, error)
 *       return null
 *     }
 *   }
 * )
 *
 * // Just success handling
 * const transformed = maybeAsync(
 *   () => getValue(),
 *   {
 *     then: (value) => value.toUpperCase()
 *   }
 * )
 * ```
 *
 * @category Utilities
 */
export function maybeAsync<T, R = T, E = unknown>(
  fn: () => T,
  handlers: MaybeAsyncHandlers<T extends Promise<infer U> ? U : T, R, E> = {},
): T extends Promise<infer U> ? Promise<R | U | E> : R | T | E {
  const envelope = maybeAsyncEnvelope(fn)
  const onCatch = handlers.catch

  if (isShape(envelope)) {
    // Async path
    return envelope.then((env) => {
      if (env.fail) {
        if (onCatch) {
          return onCatch(env.value, true)
        }
        Lang.throw(env.value)
      }
      if (handlers.then) {
        return handlers.then(env.value as any)
      }
      return env.value
    }) as any
  }

  // Sync path
  if (envelope.fail) {
    if (onCatch) {
      return onCatch(envelope.value, false) as any
    }
    Lang.throw(envelope.value)
  }

  if (handlers.then) {
    return handlers.then(envelope.value as any) as any
  }

  return envelope.value as any
}

/**
 * Display handler for Promise type.
 * @internal
 */
import type { Display } from '#ts/ts'
declare global {
  namespace KITZ.Traits.Display {
    interface Handlers<$Type> {
      _promise: $Type extends Promise<infer __value__> ? `Promise<${Display<__value__>}>` : never
    }
  }
}

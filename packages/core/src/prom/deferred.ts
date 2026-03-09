import { Lang } from '#lang'

/**
 * A deferred promise with exposed resolve and reject functions.
 *
 * @example
 * ```ts
 * const deferred = createDeferred<number>()
 *
 * // Later resolve it
 * deferred.resolve(42)
 *
 * // Or reject it
 * deferred.reject(new Error('failed'))
 *
 * // Use the promise
 * await deferred.promise  // 42
 * ```
 *
 * @example
 * ```ts
 * // Check resolution state
 * const deferred = createDeferred<number>()
 * console.log(deferred.isResolved)  // false
 * deferred.resolve(42)
 * console.log(deferred.isResolved)  // true
 * console.log(deferred.isSettled)   // true
 * ```
 *
 * @category Deferred
 */
export interface Deferred<$Value> {
  /**
   * The promise that will be resolved or rejected.
   */
  promise: Promise<$Value>
  /**
   * Resolve the promise with a value.
   */
  resolve: (value: $Value) => void
  /**
   * Reject the promise with an error.
   */
  reject: (error: unknown) => void
  /**
   * Whether the promise has been resolved.
   */
  readonly isResolved: boolean
  /**
   * Whether the promise has been rejected.
   */
  readonly isRejected: boolean
  /**
   * Whether the promise has been settled (resolved or rejected).
   */
  readonly isSettled: boolean
}

/**
 * Create a deferred promise with exposed resolve and reject functions.
 *
 * @param options - Configuration options
 * @param options.strict - If true, throws error when resolve/reject called multiple times
 * @returns A deferred promise object
 *
 * @example
 * ```ts
 * const deferred = createDeferred<number>()
 *
 * setTimeout(() => {
 *   deferred.resolve(42)
 * }, 1000)
 *
 * const result = await deferred.promise  // 42
 * ```
 *
 * @example
 * ```ts
 * // Strict mode prevents multiple resolutions
 * const deferred = createDeferred<number>({ strict: true })
 *
 * deferred.resolve(1)
 * deferred.resolve(2)  // Throws error
 * ```
 *
 * @category Deferred
 */
export const createDeferred = <$T>(options?: { strict?: boolean }): Deferred<$T> => {
  let resolve: ((value: $T) => void) | undefined
  let reject: ((error: unknown) => void) | undefined
  let resolved = false
  let rejected = false

  const promise = new Promise<$T>((res, rej) => {
    resolve = res
    reject = rej
  })

  const strictGuard = (fn: () => void) => {
    if (options?.strict && (resolved || rejected)) {
      Lang.throw(new Error('Deferred promise already settled'))
    }
    fn()
  }

  return {
    promise,
    resolve: (value: $T) => {
      if (options?.strict) {
        strictGuard(() => {
          resolved = true
          resolve!(value)
        })
      } else {
        resolved = true
        resolve!(value)
      }
    },
    reject: (error: unknown) => {
      if (options?.strict) {
        strictGuard(() => {
          rejected = true
          reject!(error)
        })
      } else {
        rejected = true
        reject!(error)
      }
    },
    get isResolved() {
      return resolved
    },
    get isRejected() {
      return rejected
    },
    get isSettled() {
      return resolved || rejected
    },
  }
}

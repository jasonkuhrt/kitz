import { CoreErr } from '#err/core'
import { Prom } from '#prom'

/**
 * Options for memoization behavior.
 */
export interface MemoOptions<$fn extends (...args: any[]) => unknown> {
  /**
   * Function to create cache keys from arguments.
   * - If `null`, uses first argument directly as key (enables WeakMap for object args)
   * - If provided, this function should return a unique key for the arguments
   * @default JSON.stringify
   */
  key?: null | (($parameters: Parameters<$fn>) => unknown)

  /**
   * Whether to cache returned Error instances.
   * This only affects functions that return Error objects as values (not thrown errors).
   * Thrown errors are never cached regardless of this setting.
   * @default false
   */
  cacheErrors?: boolean

  /**
   * Use WeakMap for caching (keys must be objects).
   * Enables garbage collection of cached values when keys are no longer referenced.
   * Requires `key: null` or a key function that returns objects.
   * @default false
   */
  weak?: boolean

  /**
   * Optional cache to use for storage.
   * If provided, the memoized function will use this cache instead of creating its own.
   * This allows sharing cache between multiple memoized functions.
   */
  cache?: Map<unknown, unknown> | WeakMap<object, unknown>
}

/**
 * A memoized function with cache management methods.
 */
export interface Memoized<$fn extends (...args: any[]) => unknown> {
  (...args: Parameters<$fn>): ReturnType<$fn>
  /** Clear the entire cache. Not available for WeakMap caches. */
  clear: () => void
  /** Clear a specific cache entry. */
  clearKey: (key: unknown) => void
  /** Access the underlying cache. */
  cache: Map<unknown, unknown> | WeakMap<object, unknown>
}

/** Internal envelope to distinguish "not cached" from "cached undefined". */
interface CacheEnvelope<$T> {
  value: $T
}

/**
 * Creates a memoized version of a function that caches its results.
 *
 * Memoization stores results of function calls and returns cached results
 * when the same inputs occur again.
 *
 * @example
 * ```ts
 * // Simple memoization (JSON.stringify key)
 * const add = Fn.memo((a: number, b: number) => a + b)
 * add(1, 2) // computes
 * add(1, 2) // cached
 * ```
 *
 * @example
 * ```ts
 * // WeakMap for object keys (no memory leaks)
 * const processSchema = Fn.memo(
 *   (schema: Schema) => expensiveTransform(schema),
 *   { weak: true, key: null }
 * )
 * ```
 *
 * @example
 * ```ts
 * // Custom key function
 * const getUser = Fn.memo(
 *   (user: { id: string }) => fetchUser(user.id),
 *   { key: ([user]) => user.id }
 * )
 * ```
 *
 * @example
 * ```ts
 * // Shared cache between functions
 * const cache = new Map()
 * const fn1 = Fn.memo(compute1, { cache })
 * const fn2 = Fn.memo(compute2, { cache })
 * cache.clear() // clears both
 * ```
 */
export const memo = <$fn extends (...args: any[]) => unknown>(
  fn: $fn,
  options?: MemoOptions<$fn>,
): Memoized<$fn> => {
  const { key, cacheErrors = false, weak = false } = options ?? {}

  const cache: Map<unknown, unknown> | WeakMap<object, unknown> =
    options?.cache ?? (weak ? new WeakMap<object, unknown>() : new Map<unknown, unknown>())

  const createKey = key === null ? (args: Parameters<$fn>) => args[0] : (key ?? JSON.stringify)

  const memoizedFn = ((...args: Parameters<$fn>) => {
    const cacheKey = createKey(args)

    if (cache.has(cacheKey as any)) {
      const envelope = cache.get(cacheKey as any) as CacheEnvelope<unknown>
      return envelope.value
    }

    // Handle both sync and async results uniformly
    const handlers: Prom.MaybeAsyncHandlers<unknown, unknown> = {}
    Reflect.set(handlers, `then`, (resolved: unknown) => {
      if (!CoreErr.is(resolved) || cacheErrors) {
        cache.set(cacheKey as any, { value: resolved })
      }
      return resolved
    })

    return Prom.maybeAsync(() => fn(...args), handlers) as ReturnType<$fn>
  }) as Memoized<$fn>

  memoizedFn.cache = cache
  memoizedFn.clear = () => {
    if (cache instanceof Map) {
      cache.clear()
    }
    // WeakMap has no clear() - it's GC-managed
  }
  memoizedFn.clearKey = (key: unknown) => cache.delete(key as any)

  return memoizedFn
}

/**
 * Memoize with WeakMap - convenience for object-keyed single-arg functions.
 *
 * Equivalent to `memo(fn, { weak: true, key: null })`.
 *
 * @example
 * ```ts
 * const processSchema = Fn.memoWeak((schema: Schema) => transform(schema))
 * processSchema(schema1) // computes
 * processSchema(schema1) // cached
 * // schema1 can be GC'd when no longer referenced elsewhere
 * ```
 */
export const memoWeak = <$key extends object, $result>(
  fn: (key: $key) => $result,
): Memoized<(key: $key) => $result> => {
  return memo(fn, { weak: true, key: null })
}

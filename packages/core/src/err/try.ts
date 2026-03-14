import type { Arr } from '#arr'
import type { Bool } from '#bool'
import { Fn } from '#fn'
import { Lang } from '#lang'
import { Prom } from '#prom'
import type { AwaitedUnion } from '#prom/prom'
import type { Ts } from '#ts'
import type { IsUnknown } from 'type-fest'
import { ensure, is } from './type.js'
import { wrap, type WrapOptions } from './wrap.js'

/**
 * Helper type for tryOr that enforces sync fallback when main is sync.
 * If main function returns Promise, fallback can be sync or async.
 * If main function is sync, fallback must be sync.
 *
 * Special handling for never: Since `never` extends everything (including `Promise<any>`),
 * we must check for it explicitly before checking for Promise. When the return type is `never`,
 * the function always throws, so the result type is just the fallback.
 */
// oxfmt-ignore
type TryOrReturn<$Main, $Fallback> =
  Ts.IsNever<$Main> extends true
    ? Fn.resolveLazy<$Fallback>  // Function always throws -> just return fallback type
    : [$Main] extends [Promise<infer M>]
      ? Promise<Awaited<M> | Awaited<Fn.resolveLazy<$Fallback>>>
      : Fn.resolveLazy<$Fallback> extends Promise<any> ? never
      : $Main | Fn.resolveLazy<$Fallback>

/**
 * Default error types caught by try/catch functions when no predicates are specified.
 *
 * @category Try-Catch
 */
export type TryCatchDefaultPredicateTypes = Error

/**
 * Transform a function to return caught errors instead of throwing them.
 * The transformed function will return either the result or the caught error.
 *
 * @param fn - The function to transform
 * @param predicates - Type predicates to filter which errors to catch (defaults to all Error instances)
 * @returns A new function that returns results or errors instead of throwing
 *
 * @example
 * ```ts
 * // Transform a throwing function
 * const parseJsonSafe = tryCatchify(JSON.parse)
 * const result = parseJsonSafe('{"valid": true}') // { valid: true }
 * const error = parseJsonSafe('invalid') // SyntaxError
 *
 * // With custom error predicates
 * const isNetworkError = (e: unknown): e is NetworkError =>
 *   e instanceof Error && e.name === 'NetworkError'
 *
 * const fetchSafe = tryCatchify(fetch, [isNetworkError])
 * const response = await fetchSafe(url) // Response | NetworkError
 * ```
 *
 * @category Try-Catch
 */
// oxfmt-ignore
export const tryCatchify = <fn extends Fn.AnyAny, thrown>(
  fn: fn,
  predicates: readonly [Bool.TypePredicate<thrown>, ...readonly Bool.TypePredicate<thrown>[]] = [is as Bool.TypePredicate<thrown>],
): (
  (...args: Parameters<fn>) =>
    AwaitedUnion<
      ReturnType<fn>,
      IsUnknown<thrown> extends true ? TryCatchDefaultPredicateTypes : thrown
    >
) => {
  const tryCatchifiedFn: Fn.AnyAny = (...args) => {
    return tryCatch(() => fn(...args), predicates)
  }
  return tryCatchifiedFn
}

/**
 * Try to execute a function or resolve a promise, catching errors instead of throwing.
 * Returns either the successful result or the caught error.
 *
 * @param fnOrPromise - Function to execute or promise to resolve
 * @param predicates - Type predicates to filter which errors to catch (defaults to all Error instances)
 * @returns The result if successful, or the caught error
 *
 * @example
 * ```ts
 * // With function
 * const result = tryCatch(() => JSON.parse(input)) // parsed value | Error
 *
 * // With promise
 * const data = await tryCatch(fetch(url)) // Response | Error
 *
 * // With custom predicates
 * const isNetworkError = (e: unknown): e is NetworkError =>
 *   e instanceof Error && e.name === 'NetworkError'
 *
 * const response = tryCatch(
 *   () => fetch(url),
 *   [isNetworkError]
 * ) // Response | NetworkError
 * ```
 *
 * @category Try-Catch
 */
// Overload for promise input
// oxfmt-ignore
export function tryCatch<returned, thrown>(
  promise: Promise<returned>,
  predicates?: readonly [Bool.TypePredicate<thrown>, ...readonly Bool.TypePredicate<thrown>[]],
): Promise<returned | (IsUnknown<thrown> extends true ? TryCatchDefaultPredicateTypes : thrown)>

// Overload for function input
// oxfmt-ignore
export function tryCatch<returned, thrown>(
  fn: () => returned,
  predicates?: Arr.NonEmpty<Bool.TypePredicate<thrown>>,
):
  AwaitedUnion<
    returned,
    IsUnknown<thrown> extends true ? TryCatchDefaultPredicateTypes : thrown
  >

// Implementation
export function tryCatch<returned, thrown>(
  fnOrPromise: Promise<any> | (() => returned),
  predicates: readonly [Bool.TypePredicate<thrown>, ...(readonly Bool.TypePredicate<thrown>[])] = [
    is as Bool.TypePredicate<thrown>,
  ],
): any {
  // Wrap promise in function if needed
  const fn = Prom.isShape(fnOrPromise) ? () => fnOrPromise : fnOrPromise

  return Prom.maybeAsync(fn as any, {
    catch(thrown) {
      const error = ensure(thrown)
      if (predicates.some((predicate) => predicate(error))) {
        return error
      }
      Lang.throw(error)
    },
  })
}

/**
 * Try to execute a function and silently ignore any errors.
 * Returns the result if successful, or undefined if it throws.
 * For async functions, errors are silently caught without rejection.
 *
 * @param fn - The function to execute
 * @returns The result of the function if successful, undefined otherwise
 *
 * @example
 * ```ts
 * // Sync function
 * tryCatchIgnore(() => JSON.parse(invalidJson)) // returns undefined
 *
 * // Async function
 * await tryCatchIgnore(async () => {
 *   throw new Error('Network error')
 * }) // returns undefined, no rejection
 * ```
 *
 * @category Try-Catch
 */
export const tryCatchIgnore = <$Return>(fn: () => $Return): $Return => {
  return Prom.maybeAsync(fn, { catch: () => undefined }) as any
}

/**
 * Try to execute a function and return a fallback value if it throws.
 *
 * **Type constraints:**
 * - If `fn` is synchronous, `fallback` must also be synchronous
 * - If `fn` is asynchronous, `fallback` can be either sync or async
 * - For sync functions with async fallbacks, use {@link tryOrAsync} instead
 *
 * @param fn - The function to execute
 * @param fallback - The fallback value or function (must be sync if fn is sync)
 * @returns The result of the function if successful, or the fallback value if it throws
 *
 * @example
 * ```ts
 * // Sync function with sync fallback
 * const data = tryOr(
 *   () => JSON.parse(input),
 *   { error: 'Invalid JSON' }
 * )
 *
 * // Async function with sync fallback
 * const config = await tryOr(
 *   async () => loadConfig(),
 *   () => getDefaultConfig()
 * )
 *
 * // Async function with async fallback
 * const data = await tryOr(
 *   async () => fetchFromPrimary(),
 *   async () => fetchFromSecondary()
 * )
 *
 * // This would be a TYPE ERROR:
 * // const bad = tryOr(
 * //   () => 42,                    // sync
 * //   async () => 'fallback'       // async - not allowed!
 * // )
 * ```
 *
 * @category Try-Or
 */
export const tryOr = <success, fallback>(
  fn: () => success,
  fallback: Fn.LazyMaybe<fallback>,
): TryOrReturn<success, fallback> => {
  return Prom.maybeAsync(fn, { catch: () => Fn.resolveLazy(fallback) }) as any
}

/**
 * Try to execute a function and return a fallback value if it throws.
 * Always returns a Promise, allowing async fallbacks for sync functions.
 *
 * Use this when:
 * - You have a sync function with an async fallback
 * - You want consistent async behavior regardless of input types
 *
 * @param fn - The function to execute (sync or async)
 * @param fallback - The fallback value or function (sync or async)
 * @returns Always returns a Promise of the result or fallback
 *
 * @example
 * ```ts
 * // Sync function with async fallback
 * const data = await tryOrAsync(
 *   () => readFileSync('config.json'),
 *   async () => fetchDefaultConfig()
 * )
 *
 * // Ensures consistent Promise return
 * const result = await tryOrAsync(
 *   () => 42,
 *   () => 'fallback'
 * ) // Always Promise<number | string>
 * ```
 *
 * @category Try-Or
 */
export const tryOrAsync = async <success, fallback>(
  fn: () => success,
  fallback: Fn.LazyMaybe<fallback>,
): Promise<Awaited<success> | Awaited<fallback>> => {
  const envelope = await Prom.maybeAsyncEnvelope(fn)
  if (!envelope.fail) {
    return envelope.value as Awaited<success>
  }

  const fallbackValue: fallback = Fn.is(fallback) ? fallback() : fallback
  return await fallbackValue
}

/**
 * Curried version of {@link tryOrAsync} that takes the function first.
 * Useful for creating reusable async error handlers.
 *
 * @example
 * ```ts
 * const parseJsonOrFetch = tryOrAsyncOn(() => JSON.parse(input))
 * const data = await parseJsonOrFetch(async () => fetchDefault())
 * ```
 *
 * @category Try-Or
 */
// oxfmt-ignore
export const tryOrAsyncOn =
  <success>(fn: () => success) =>
    async <fallback>(fallback: Fn.LazyMaybe<fallback>): Promise<Awaited<success> | Awaited<fallback>> =>
      tryOrAsync(fn, fallback)

/**
 * Curried version of {@link tryOrAsync} that takes the fallback first.
 * Always returns a Promise regardless of input types.
 *
 * @example
 * ```ts
 * const orFetchDefault = tryOrAsyncWith(async () => fetchDefault())
 * const data1 = await orFetchDefault(() => localData())
 * const data2 = await orFetchDefault(() => cachedData())
 * ```
 *
 * @category Try-Or
 */
// oxfmt-ignore
export const tryOrAsyncWith =
  <fallback>(fallback: Fn.LazyMaybe<fallback>) =>
    async <success>(fn: () => success): Promise<Awaited<success> | Awaited<fallback>> =>
      tryOrAsync(fn, fallback)

/**
 * Curried version of {@link tryOr} that takes the function first.
 * Useful for creating reusable error handlers.
 *
 * **Note:** Same type constraints as {@link tryOr} apply - sync functions require sync fallbacks.
 *
 * @example
 * ```ts
 * const parseJsonOr = tryOrOn(() => JSON.parse(input))
 * const data = parseJsonOr({ error: 'Invalid JSON' })
 * ```
 *
 * @category Try-Or
 */
// oxfmt-ignore
export const tryOrOn =
  <success>(fn: () => success) =>
    <fallback>(fallback: Fn.LazyMaybe<fallback>): TryOrReturn<success, fallback> =>
      tryOr(fn, fallback)

/**
 * Curried version of {@link tryOr} that takes the fallback first.
 * Useful for creating reusable fallback patterns.
 *
 * **Note:** Same type constraints as {@link tryOr} apply - sync functions require sync fallbacks.
 *
 * @example
 * ```ts
 * const orDefault = tryOrWith({ status: 'unknown', data: null })
 *
 * const result1 = orDefault(() => fetchStatus())
 * const result2 = orDefault(() => getLatestData())
 * ```
 *
 * @category Try-Or
 */
// oxfmt-ignore
export const tryOrWith =
  <fallback>(fallback: Fn.LazyMaybe<fallback>) =>
    <success>(fn: () => success): TryOrReturn<success, fallback> =>
      tryOr(fn, fallback)

/**
 * Try to execute a function and return undefined if it throws.
 * Shorthand for `tryOrWith(undefined)`.
 *
 * @example
 * ```ts
 * const data = tryOrUndefined(() => localStorage.getItem('key'))
 * // data is string | undefined
 * ```
 *
 * @category Try-Or
 */
export const tryOrUndefined = tryOrWith(undefined)

/**
 * Try to execute a function and return null if it throws.
 * Shorthand for `tryOrWith(null)`.
 *
 * @example
 * ```ts
 * const user = await tryOrNull(async () => fetchUser(id))
 * // user is User | null
 * ```
 *
 * @category Try-Or
 */
export const tryOrNull = tryOrWith(null)

/**
 * Try to execute a function and wrap any thrown errors with a higher-level message.
 * Handles both synchronous and asynchronous functions automatically.
 *
 * @param fn - The function to execute
 * @param wrapper - Result a string message, options object, or a function that wraps the error
 * @returns The result of the function if successful
 * @throws The wrapped error if the function throws
 *
 * @example
 * ```ts
 * // Simple string message
 * const data = await tryOrRethrow(
 *   fetchData,
 *   'Failed to fetch data'
 * )
 *
 * // With options
 * const user = await tryOrRethrow(
 *   () => fetchUser(userId),
 *   { message: 'Failed to fetch user', context: { userId } }
 * )
 *
 * // With wrapper function
 * const result = await tryOrRethrow(
 *   riskyOperation,
 *   wrapWith('Operation failed')
 * )
 *
 * // Custom error wrapper
 * const config = await tryOrRethrow(
 *   loadConfig,
 *   (cause) => new ConfigError('Failed to load config', { cause })
 * )
 * ```
 *
 * @category Try-Or
 */
// oxfmt-ignore
export function tryOrRethrow<$Return>(
  fn: () => $Return,
  wrapper: string | WrapOptions | ((cause: Error) => Error)
): $Return extends Promise<any> ? $Return : ReturnType<typeof fn> {
  return Prom.maybeAsync(
    fn,
    {
      catch: (thrown, _isAsync) => {
        const cause = ensure(thrown)
        if (typeof wrapper === 'function') {
          return Lang.throw(wrapper(cause))
        }

        return Lang.throw(wrap(cause, wrapper))
      },
    },
  ) as any
}

/**
 * Try multiple functions and wrap any errors with a higher-level message.
 * If any function throws, all errors are collected into an AggregateError.
 *
 * @param fns - Array of functions to execute
 * @param wrapper - Result a string message, options object, or a function that wraps the error
 * @returns Array of results if all succeed
 * @throws AggregateError with wrapped individual errors if any fail
 *
 * @example
 * ```ts
 * const [users, posts] = await tryAllOrRethrow(
 *   [fetchUsers, fetchPosts],
 *   'Failed to load data'
 * )
 *
 * // With context
 * const [config, schema, data] = await tryAllOrRethrow(
 *   [loadConfig, loadSchema, loadData],
 *   { message: 'Failed to initialize', context: { env: 'production' } }
 * )
 * ```
 *
 * @category Try-Or
 */
export async function tryAllOrRethrow<$Fns extends readonly [() => any, ...Array<() => any>]>(
  fns: $Fns,
  wrapper: string | WrapOptions | ((cause: Error) => Error),
): Promise<{
  [K in keyof $Fns]: Awaited<ReturnType<$Fns[K]>>
}> {
  const results = await Promise.all(
    fns.map(async (fn) => {
      const envelope = await Prom.maybeAsyncEnvelope(fn)
      return envelope.fail
        ? ({ status: 'rejected', reason: envelope.value } as const)
        : ({ status: 'fulfilled', value: envelope.value } as const)
    }),
  )

  const errors: Error[] = []
  const values: any[] = []

  results.forEach((result) => {
    if (result.status === 'rejected') {
      const cause = ensure(result.reason)
      const wrapFn =
        typeof wrapper === 'function' ? wrapper : (error: Error) => wrap(error, wrapper)
      errors.push(wrapFn(cause))
    } else {
      values.push(result.value)
    }
  })

  if (errors.length > 0) {
    Lang.throw(
      new AggregateError(
        errors,
        typeof wrapper === 'string'
          ? wrapper
          : typeof wrapper === 'object'
            ? wrapper.message
            : 'Multiple operations failed',
      ),
    )
  }

  return values as any
}

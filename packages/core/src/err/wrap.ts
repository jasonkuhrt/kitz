import { CoreFn as Fn } from '#fn/core'
import { mergeStacks } from './stack.js'
import { ensure } from './type.js'
import type { Context } from './types.js'

/**
 * Options for wrapping errors with additional context.
 *
 * @category Wrapping
 */
export interface WrapOptions {
  /**
   * The error message for the wrapper error.
   */
  message: string
  /**
   * Additional context to attach to the error.
   */
  context?: Context
}

/**
 * Wrap an error with a higher-level error message.
 * If the input is not an Error, it will be converted to one using {@link ensure}.
 *
 * @param cause - The error to wrap (will be set as the cause)
 * @param messageOrOptions - Either a string message or options with message and context
 * @returns A new Error with the given message and the original error as cause
 *
 * @example
 * ```ts
 * try {
 *   await fetchData()
 * } catch (error) {
 *   throw wrap(error, 'Failed to fetch data')
 * }
 *
 * // With context
 * try {
 *   await fetchUser(userId)
 * } catch (error) {
 *   throw wrap(error, {
 *     message: 'Failed to fetch user',
 *     context: { userId }
 *   })
 * }
 * ```
 *
 * @category Wrapping
 */
export const wrap = (cause: unknown, messageOrOptions: string | WrapOptions): Error => {
  const ensuredCause = ensure(cause)
  const options =
    typeof messageOrOptions === 'string' ? { message: messageOrOptions } : messageOrOptions

  const error = new Error(options.message, { cause: ensuredCause })

  if (options.context !== undefined) {
    Object.assign(error, { context: options.context })
  }

  // Enhance stack trace by merging with cause
  if (error.stack && ensuredCause.stack) {
    error.stack = mergeStacks(error, ensuredCause)
  }

  return error
}

/**
 * Curried version of {@link wrap} that takes the error first.
 * Useful for error handling pipelines.
 *
 * @example
 * ```ts
 * const wrapFetchError = wrapOn(networkError)
 * throw wrapFetchError('Failed to fetch data')
 * ```
 *
 * @category Wrapping
 */
export const wrapOn = Fn.curry(wrap)

/**
 * Curried version of {@link wrap} that takes the message/options first.
 * Useful for creating reusable error wrappers.
 *
 * @example
 * ```ts
 * const wrapAsFetchError = wrapWith('Failed to fetch data')
 *
 * try {
 *   await fetchData()
 * } catch (error) {
 *   throw wrapAsFetchError(error)
 * }
 *
 * // With context
 * const wrapAsUserError = wrapWith({
 *   message: 'Failed to process user',
 *   context: { operation: 'update' }
 * })
 * ```
 *
 * @category Wrapping
 */
export const wrapWith = Fn.flipCurried(wrapOn)

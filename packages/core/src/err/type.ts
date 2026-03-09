/**
 * Type predicate to check if a value is an Error instance.
 * @param value - The value to check
 * @returns True if the value is an Error instance
 * @example
 * ```ts
 * is(new Error('test')) // true
 * is('not an error') // false
 * is(null) // false
 * ```
 *
 * @category Type Guards
 */
export const is = (value: unknown): value is Error => {
  // TODO: use upcoming Error.isError() once its widely available.
  // See: https://github.com/tc39/proposal-is-error
  return value instanceof Error
}

/**
 * Check if a value is an AggregateError instance.
 *
 * @category Type Guards
 */
export const isAggregateError = (value: unknown): value is AggregateError => {
  return value instanceof AggregateError
}

/**
 * Check if an error is an AbortError (from AbortController/AbortSignal).
 *
 * @param error - The error to check
 * @returns True if the error is an AbortError
 * @example
 * ```ts
 * const controller = new AbortController()
 * controller.abort()
 *
 * try {
 *   await fetch(url, { signal: controller.signal })
 * } catch (error) {
 *   if (isAbortError(error)) {
 *     console.log('Request was aborted')
 *   }
 * }
 * ```
 *
 * @category Type Guards
 */
export const isAbortError = (error: any): error is DOMException & { name: 'AbortError' } => {
  return (
    error instanceof Error && error.name === 'AbortError' && 'code' in error && error.code === 20
  )
}

/**
 * Ensure that the given value is an error and return it. If it is not an error than
 * wrap it in one, passing the given value as the error message.
 *
 * @category Conversion
 */
export const ensure = (value: unknown): Error => {
  if (value instanceof Error) return value

  if (
    typeof value === `string` ||
    typeof value === `number` ||
    typeof value === `boolean` ||
    typeof value === `bigint` ||
    typeof value === `symbol` ||
    value === null ||
    value === undefined
  ) {
    return new Error(String(value))
  }

  return new Error(Object.prototype.toString.call(value))
}

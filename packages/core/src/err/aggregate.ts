import { Data } from 'effect'

/**
 * Aggregate multiple errors with optional context.
 *
 * Similar to native AggregateError but with Effect's TaggedError benefits:
 * - Type-safe error union
 * - Context attachment
 * - Works with Effect.catchTag
 *
 * @example
 * ```typescript
 * const errors = [new Error('fail1'), new Error('fail2')]
 * throw new ContextualAggregateError({
 *   errors,
 *   context: { operation: 'batch-validation' }
 * })
 * ```
 *
 * @example
 * ```typescript
 * // Use with Effect.catchTag
 * import { Effect } from 'effect'
 *
 * program.pipe(
 *   Effect.catchTag('ContextualAggregateError', (error) =>
 *     Effect.succeed(`${error.errors.length} errors occurred`)
 *   )
 * )
 * ```
 */
export class ContextualAggregateError<
  $Errors extends Error = Error,
  $Context extends Record<string, unknown> = Record<string, unknown>,
> extends Data.TaggedError('ContextualAggregateError')<{
  errors: $Errors[]
  context?: $Context
  cause?: $Errors
}> {
  constructor(options: {
    errors: $Errors[]
    message?: string
    context?: $Context
  }) {
    const props: any = {
      errors: options.errors,
    }
    if (options.context !== undefined) props.context = options.context
    if (options.errors[0] !== undefined) props.cause = options.errors[0]
    super(props)
  }
}

/**
 * Partition results into values and errors, aggregating errors if any exist.
 *
 * @param results - Mixed array of values and errors
 * @param message - Optional message for aggregate error
 * @returns Tuple of [values, aggregateError | null]
 *
 * @example
 * ```typescript
 * const results = [1, new Error('fail'), 2, new Error('fail2')]
 * const [values, error] = partitionAndAggregateErrors(results)
 * // values: [1, 2]
 * // error: ContextualAggregateError with 2 errors
 * ```
 *
 * @example
 * ```typescript
 * // All values, no errors
 * const [values, error] = partitionAndAggregateErrors([1, 2, 3])
 * // values: [1, 2, 3]
 * // error: null
 * ```
 *
 * @example
 * ```typescript
 * // Custom message
 * const [, error] = partitionAndAggregateErrors(
 *   [new Error('a'), new Error('b')],
 *   'Multiple validation errors'
 * )
 * ```
 */
export const partitionAndAggregateErrors = <$Results>(
  results: $Results[],
  message?: string,
): [Exclude<$Results, Error>[], null | ContextualAggregateError<Extract<$Results, Error>>] => {
  const [values, errors] = results.reduce(
    ([vals, errs], result) => {
      if (result instanceof Error) {
        errs.push(result as any)
      } else {
        vals.push(result as any)
      }
      return [vals, errs]
    },
    [[], []] as [Exclude<$Results, Error>[], Extract<$Results, Error>[]],
  )

  if (errors.length === 0) {
    return [values, null]
  }

  return [
    values,
    new ContextualAggregateError({
      errors,
      message: message ?? 'One or more operations failed.',
    }) as any,
  ]
}

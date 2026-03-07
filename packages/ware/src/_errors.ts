// Error classes needed by ware module
// Copied from Graffle to keep ware self-contained

import { Arr } from '@kitz/core'
export type Cause = Error | undefined
export type Context = object

/**
 * Error enhanced with a context object.
 */
export class ContextualError<
  $Name extends string = string,
  $Context extends Context = object,
  $Cause extends Cause | undefined = Cause | undefined,
> extends Error {
  override name: $Name = `ContextualError` as $Name
  constructor(
    message: string,
    public readonly context: $Context = {} as $Context,
    public override readonly cause: $Cause = undefined as $Cause,
  ) {
    super(message, cause)
  }
}

/**
 * Aggregation Error enhanced with a context object and types members.
 */
export class ContextualAggregateError<
  $Errors extends Error | ContextualError = ContextualError,
  $Name extends string = `ContextualAggregateError`,
  $Context extends object = object,
> extends ContextualError<$Name, $Context> {
  override name: $Name = `ContextualAggregateError` as $Name
  constructor(
    message: string,
    context: $Context,
    public readonly errors: readonly $Errors[],
  ) {
    super(message, context, undefined)
  }
}

export const partitionAndAggregateErrors = <$Results>(
  results: $Results[],
): [Exclude<$Results, Error>[], null | ContextualAggregateError<Extract<$Results, Error>>] => {
  const [values, errors] = Arr.partitionErrors(results)
  const error =
    errors.length > 0
      ? new ContextualAggregateError(`One or more extensions are invalid.`, {}, errors)
      : null
  return [values, error]
}

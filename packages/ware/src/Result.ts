import type { ContextualAggregateError } from './_errors.js'

export type ResultFailure = Error | ContextualAggregateError

export type Result<T = unknown> = ResultFailure | ResultSuccess<T>

export interface ResultSuccess<T = unknown> {
  value: T
}

export const successfulResult = <$Value>(value: $Value): ResultSuccess<$Value> => ({ value })

import { Ts } from '@kitz/core'
import type { AssertActual, AssertExpected } from './asserts.js'
import type { State } from './state.js'

export type GuardActual<$actual, $State extends State> = Guard<
  $actual,
  AssertActual<$actual, $State>
>

export type GuardExpected<$expected, $State extends State> = Guard<
  $expected,
  AssertExpected<$expected, $State>
>

/**
 * Thin guard wrapper - converts validation result to Error | $Value.
 * Returns $Value on success (validation = never), Error on failure.
 */
// oxfmt-ignore
type Guard<$Value, ___Validation extends Ts.Err.StaticError,
> = [___Validation] extends [never]
  ? $Value
  : Ts.Err.Show<___Validation>

import { Fn, Optic, Ts } from '@kitz/core'
import type { Result } from 'effect'
import type { StaticErrorAssertion } from '../assertion-error.js'
import * as Asserts from '../asserts.js'
import type { State } from './state.js'

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Normalization
//
//
//
//

/**
 * Normalize types for comparison based on inference mode from state.
 *
 * - `'auto'` - Strip readonly deep for readonly-agnostic comparison
 * - `'wide'` - No normalization (identity)
 * - `'narrow'` - No normalization (identity)
 *
 * This enables auto mode to ignore readonly modifiers when comparing types,
 * while wide/narrow modes respect them.
 */
// oxfmt-ignore
type NormalizeForComparison<$T, $State extends State> = {
  'auto': Ts.StripReadonlyDeep<$T>
  'narrow': $T
  'wide': $T
}[$State['matcher_inferMode']]

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Assert
//
//
//
//

export type AssertActual<
  $actual,
  $State extends State,
> = $State['matcher_relator'] extends Fn.Kind.Kind
  ? Assert<$State['expected_type'], $actual, $State>
  : Ts.Err.StaticErrorMessage<'No relator set'>

export type AssertExpected<
  $expected,
  $State extends State,
> = $State['matcher_relator'] extends Fn.Kind.Kind
  ? Assert<$expected, $State['actual_type'], $State>
  : Ts.Err.StaticErrorMessage<'No relator set'>

/**
 * Pure validation - returns Error | never.
 * Handles extraction, extraction errors, and relation validation.
 */
// oxfmt-ignore
type Assert<
  $Expected,
  $RawActual,
  $State extends State,
  ___$ExtractionResult = Fn.Kind.PipeRight<$RawActual, $State['actual_extractors']>,
> =
  // Check if extraction failed
  ___$ExtractionResult extends Result.Failure<infer _, infer __error__>  ? __error__ :
  ___$ExtractionResult extends Result.Success<infer __value__, infer _> ?
    (
      Ts.IsUnknown<__value__> extends true
        ? $State['matcher_allowUnknown'] extends true
          ? AssertsKindApply<$Expected, __value__, $State>
          : Ts.Err.StaticErrorMessage<'Type unknown is not a valid actual type to assertion on unless flag has been set'>
        : AssertsKindApply<$Expected, __value__, $State>
    )
                                                                      : never // Shouldn't happen - ApplyExtractors always returns Result
type AssertsKindApply<
  $Expected,
  $Actual,
  $State extends State,
  ___$ExpectedNormalized = NormalizeForComparison<$Expected, $State>,
  ___$ActualNormalized = NormalizeForComparison<$Actual, $State>,
> = Asserts.KindApply<
  $State['matcher_relator'],
  [___$ExpectedNormalized, ___$ActualNormalized, $State['matcher_negated']]
>

//
//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • AssertEdgeType
//
//
//
//

/**
 * Validate edge types (never/any/unknown) using inhabitance-based lookup.
 *
 * Uses Inhabitance.GetCase to determine the type case, then dispatches to
 * ValidateEdgeType for proper edge types. Returns never for proper types.
 */
// oxfmt-ignore
export type AssertEdgeType<
  $Value,
  $State extends State,
  ___Case extends Ts.Inhabitance.Case = Ts.Inhabitance.GetCase<$Value>
> = {
  'never': AssertEdgeType_<'never', $State>,
  'any': AssertEdgeType_<'any', $State>,
  // having this here breaks inference wherein unknown needs to be tolerated until TS has resolved the arg type
  // 'unknown': ValidateEdgeType<'unknown', $State>,
  'unknown': never
  'proper': never
}[___Case]

/**
 * Core validation logic for edge types using 2D lookup table.
 *
 * Dimensions: allowFlag (true/false) × negated (true/false)
 */
// oxfmt-ignore
type AssertEdgeType_<
  $TypeName extends 'never' | 'any',
  $State extends State,
> = {
  false: Ts.Err.StaticError<[], { message: `Edge type ${$TypeName} not allowed by default, opt in with .${$TypeName}()` }>,
  true: StaticErrorAssertion<`Expected type to not be ${$TypeName}, but was`>
  negated_false: never,
  negated_true: StaticErrorAssertion<`Expected type to not be ${$TypeName}, but was`>
}[
  `${$State['matcher_negated'] extends true ? 'negated_':''}${Ts.BooleanCase<$State[`matcher_allow${Capitalize<$TypeName>}`]>}`
]

//
//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Unary Relator Guards
//
//
//
//

/**
 * Guard for unary relators.
 * Dispatches via HKT pattern using Fn.Kind.Apply.
 */
export type AssertUnaryRelator<
  $actual,
  $State extends State,
  $Kind extends Fn.Kind.Kind,
  ___$ExtractionResult = Fn.Kind.PipeRight<$actual, $State['actual_extractors']>,
> =
  ___$ExtractionResult extends Result.Failure<infer _, infer __error__>
    ? __error__ // Extraction failed - propagate error
    : ___$ExtractionResult extends Result.Success<infer __value__, infer _>
      ? Fn.Kind.Apply<$Kind, [__value__, $State['matcher_negated']]>
      : never

/**
 * Unary relator assertion on an already-extracted value.
 * Used by ExecuteUnaryRelator which has already applied extractors.
 * Does NOT apply extractors - works directly on the provided value.
 */
export type AssertUnaryRelatorValue<
  $value,
  $State extends State,
  $Kind extends Fn.Kind.Kind,
> = Fn.Kind.Apply<$Kind, [$value, $State['matcher_negated']]>

//
//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Helpers
//
//

// oxfmt-ignore
export type OnlyAssertionErrorsAndShow<$Results extends readonly any[]> =
  $Results extends [infer __first__, ...infer __rest__]
    ? Ts.IsNever<__first__> extends true                         ? OnlyAssertionErrorsAndShow<__rest__>
    : Ts.IsAny<__first__> extends true                           ? OnlyAssertionErrorsAndShow<__rest__>
    : __first__ extends Ts.Err.StaticError                    ? [Ts.Err.Show<__first__>, ...OnlyAssertionErrorsAndShow<__rest__>]
                                                              : OnlyAssertionErrorsAndShow<__rest__>
                                                              : []

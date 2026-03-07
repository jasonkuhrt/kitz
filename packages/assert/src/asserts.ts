import { Fn, Obj, Ts } from '@kitz/core'
import type { Inhabitance } from '@kitz/core/ts'
import type { StaticErrorAssertion } from './assertion-error.js'

/**
 * Type safe assertion kind application.
 */
// oxfmt-ignore
export type KindApply<
  $Kind,
  $Params extends [$Expected: any, $Actual: any, $Negated: any],
  ___$Result = Fn.Kind.Apply<$Kind, $Params>,
> =
  // We know by convnetion that ___$Result is either never or StaticErrorAssertion
  // But TS don't know that, so we write the following to convince it
  ___$Result extends Ts.Err.StaticError
    ? ___$Result
    : never

/**
 * Conditionally compute diff information based on showDiff setting.
 *
 * When showDiff is false (default): Returns just the tip (or empty object if tip is never)
 * When showDiff is true: Returns diff merged with tip (or just diff if tip is never)
 *
 * @internal
 */
// oxfmt-ignore
type MaybeWithDiff<
  $Expected,
  $Actual,
  $Tip extends string,
> = Ts.Settings.GetShowDiff extends true
  ? [never] extends [$Tip]
    ? Obj.ComputeDiff<$Expected, $Actual>  // No tip, just diff
    : Obj.ComputeDiff<$Expected, $Actual> & { tip: $Tip }
  : [never] extends [$Tip]
    ? {}  // No tip, empty object
    : { tip: $Tip }

/**
 * Exact assertion kind - checks for exact structural equality.
 *
 * Part of the Higher-Kinded Types (HKT) pattern.
 *
 * Parameters: [$Expected, $Actual, $Negated?]
 * Returns: never if types are exactly equal (or not equal when negated), otherwise StaticErrorAssertion
 *
 * This is the base kind used by all `exact.*` assertions.
 * Extractors compose with this kind to transform inputs before checking.
 * When $Negated is true, the assertion is inverted.
 */
// oxfmt-ignore
export interface AssertExactKind extends AssertionKind {
  name: 'exact'
  expectationConstraint: unknown
  parameters: [$Expected: unknown, $Actual: unknown, $Negated?: boolean]
  return: AssertExact<this['parameters'][0], this['parameters'][1], this['parameters'][2]>
}

// oxfmt-ignore
export type AssertExact<$Expected, $Actual, $Negated extends boolean | undefined> = {
  pass: Pass
  fail_equivalent: StaticErrorAssertion<
    'EXPECTED and ACTUAL are only equivalent (not exact)',
    $Expected,
    $Actual,
    MaybeWithDiff<$Expected, $Actual, 'Use equiv() for mutual assignability OR apply Simplify<T> to normalize types'>
  >
  fail_subtype: StaticErrorAssertion<
    'ACTUAL is subtype of EXPECTED',
    $Expected,
    $Actual,
    MaybeWithDiff<$Expected, $Actual, never>
  >
  fail_supertype: StaticErrorAssertion<
    'ACTUAL is supertype of EXPECTED',
    $Expected,
    $Actual,
    MaybeWithDiff<$Expected, $Actual, never>
  >
  fail_overlapping: StaticErrorAssertion<
    'EXPECTED only overlaps with ACTUAL',
    $Expected,
    $Actual,
    MaybeWithDiff<$Expected, $Actual, 'Types share some values but differ'>
  >
  fail_disjoint: StaticErrorAssertion<
    'EXPECTED and ACTUAL are disjoint',
    $Expected,
    $Actual,
    MaybeWithDiff<$Expected, $Actual, 'Types share no values'>
  >
  negated_pass: StaticErrorAssertion<'ACTUAL is exactly EXPECTED but should not be', $Expected, $Actual>
  negated_fail_equivalent: Pass
  negated_fail_subtype: Pass
  negated_fail_supertype: Pass
  negated_fail_overlapping: Pass
  negated_fail_disjoint: Pass
}[
  Ts.Relation.IsExact<$Actual, $Expected> extends true
    ? [$Negated] extends [true] ? 'negated_pass' : 'pass'
    : `${NegatedInputToCaseKey<$Negated>}${
        Ts.Relation.GetRelation<$Expected, $Actual> extends infer r extends Ts.Relation.Relation ?
          r extends Ts.Relation.equivalent
            ? 'fail_equivalent'
            : `fail_${r}`
          : never
      }`
]

/**
 * Equiv assertion kind - checks for mutual assignability (semantic equality).
 *
 * Part of the Higher-Kinded Types (HKT) pattern.
 *
 * Parameters: [$Expected, $Actual, $Negated?]
 * Returns: never if types are mutually assignable (or not equivalent when negated), otherwise StaticErrorAssertion
 *
 * This is the base kind used by all `equiv.*` assertions.
 * Extractors compose with this kind to transform inputs before checking.
 * When $Negated is true, the assertion is inverted.
 */
// oxfmt-ignore
export interface AssertEquivKind extends AssertionKind {
  name: 'equiv'
  expectationConstraint: unknown
  parameters: [$Expected: unknown, $Actual: unknown, $Negated?: boolean]
  return: AssertEquiv<this['parameters'][0], this['parameters'][1], this['parameters'][2]>
}

// oxfmt-ignore
export type AssertEquiv<$Expected, $Actual, $Negated extends boolean | undefined> = {
  pass: Pass
  fail_subtype: StaticErrorAssertion<'ACTUAL extends EXPECTED but not vice versa', $Expected, $Actual>
  fail_supertype: StaticErrorAssertion<'EXPECTED extends ACTUAL but not vice versa', $Expected, $Actual>
  fail_overlapping: StaticErrorAssertion<'EXPECTED and ACTUAL overlap but not mutually assignable', $Expected, $Actual>
  fail_disjoint: StaticErrorAssertion<'EXPECTED and ACTUAL are disjoint', $Expected, $Actual>
  negated_pass: StaticErrorAssertion<'ACTUAL is equivalent to EXPECTED but should not be', $Expected, $Actual>
  negated_fail_subtype: Pass
  negated_fail_supertype: Pass
  negated_fail_overlapping: Pass
  negated_fail_disjoint: Pass
}[
  `${NegatedInputToCaseKey<$Negated>}${
    Ts.Relation.GetRelation<$Expected, $Actual> extends infer r extends Ts.Relation.Relation ?
      r extends Ts.Relation.equivalent
        ? 'pass'
        : `fail_${r}`
      : never
  }`
]

/**
 * Sub assertion kind - checks that Actual extends Expected (subtype relation).
 *
 * Part of the Higher-Kinded Types (HKT) pattern.
 *
 * Parameters: [$Expected, $Actual, $Negated?]
 * Returns: never if Actual extends Expected (or does not extend when negated), otherwise StaticErrorAssertion
 *
 * This is the base kind used by all `sub.*` assertions.
 * Extractors compose with this kind to transform inputs before checking.
 * When $Negated is true, the assertion is inverted.
 */
// oxfmt-ignore
export interface AssertSubKind extends AssertionKind {
  name: 'sub'
  expectationConstraint: unknown
  parameters: [$Expected: unknown, $Actual: unknown, $Negated?: boolean]
  return: AssertSub<this['parameters'][0], this['parameters'][1], this['parameters'][2]>
}

export type AssertSub<$Expected, $Actual, $Negated extends boolean | undefined> = {
  pass: Pass
  fail: StaticErrorAssertion<'ACTUAL does not extend EXPECTED', $Expected, $Actual>
  negated_pass: StaticErrorAssertion<'ACTUAL extends EXPECTED but should not', $Expected, $Actual>
  negated_fail: Pass
}[`${NegatedInputToCaseKey<$Negated>}${$Actual extends $Expected ? 'pass' : 'fail'}`]

/**
 * Sub + NoExcess kind - checks subtype relation AND no excess properties.
 *
 * Parameters: [$Expected, $Actual, $Negated?]
 * Returns: never if Actual extends Expected with no excess properties
 *
 * Combines two checks:
 * 1. Actual extends Expected (subtype relation)
 * 2. Actual has no object keys beyond those in Expected
 */
// oxfmt-ignore
export interface AssertSubNoExcessKind extends AssertionKind {
  name: 'sub'
  expectationConstraint: unknown
  parameters: [$Expected: unknown, $Actual: unknown, $Negated?: boolean]
  return: AssertSubNoExcess<this['parameters'][0], this['parameters'][1], this['parameters'][2]>
}

// oxfmt-ignore
export type AssertSubNoExcess<$Expected, $Actual, $Negated extends boolean | undefined> = {
  pass: Pass
  fail_not_subtype: StaticErrorAssertion<'ACTUAL does not extend EXPECTED', $Expected, $Actual>
  fail_has_excess: StaticErrorAssertion<'ACTUAL has excess properties not in EXPECTED', $Expected, $Actual, { excess: keyof Obj.SubtractShallow<$Actual, $Expected> }>
  negated_pass: StaticErrorAssertion<'ACTUAL extends EXPECTED with no excess but should not', $Expected, $Actual>
  negated_fail_not_subtype: Pass
  negated_fail_has_excess: Pass
}[
  $Actual extends $Expected
    ? [keyof Obj.SubtractShallow<$Actual, $Expected>] extends [never]
      ? `${NegatedInputToCaseKey<$Negated>}pass`
      : `${NegatedInputToCaseKey<$Negated>}fail_has_excess`
    : `${NegatedInputToCaseKey<$Negated>}fail_not_subtype`
]

/**
 * Equiv + NoExcess kind - checks mutual assignability AND no excess properties.
 *
 * Parameters: [$Expected, $Actual, $Negated?]
 * Returns: never if types are equivalent with no excess properties
 *
 * Combines two checks:
 * 1. Expected and Actual are mutually assignable (equivalent)
 * 2. Actual has no object keys beyond those in Expected
 */
// oxfmt-ignore
export interface AssertEquivNoExcessKind extends AssertionKind {
  name: 'equiv'
  expectationConstraint: unknown
  parameters: [$Expected: unknown, $Actual: unknown, $Negated?: boolean]
  return: AssertEquivNoExcess<this['parameters'][0], this['parameters'][1], this['parameters'][2]>
}

// oxfmt-ignore
export type AssertEquivNoExcess<$Expected, $Actual, $Negated extends boolean | undefined> = {
  pass: Pass
  fail_not_equivalent: StaticErrorAssertion<'EXPECTED and ACTUAL are not equivalent', $Expected, $Actual>
  fail_has_excess: StaticErrorAssertion<'ACTUAL has excess properties not in EXPECTED', $Expected, $Actual, { excess: keyof Obj.SubtractShallow<$Actual, $Expected> }>
  negated_pass: StaticErrorAssertion<'ACTUAL is equivalent to EXPECTED with no excess but should not', $Expected, $Actual>
  negated_fail_not_equivalent: Pass
  negated_fail_has_excess: Pass
}[
  Ts.Relation.GetRelation<$Expected, $Actual> extends Ts.Relation.equivalent
    ? [keyof Obj.SubtractShallow<$Actual, $Expected>] extends [never]
      ? `${NegatedInputToCaseKey<$Negated>}pass`
      : `${NegatedInputToCaseKey<$Negated>}fail_has_excess`
    : `${NegatedInputToCaseKey<$Negated>}fail_not_equivalent`
]

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Unary Relators
//
//
//
//

/**
 * Any assertion kind - checks if type is `any`.
 *
 * Part of the Higher-Kinded Types (HKT) pattern.
 *
 * Parameters: [$Actual, $Negated?]
 * Returns: never if type is any (or not any when negated), otherwise StaticErrorAssertion
 *
 * This is the base kind used by all `*.any()` assertions.
 * When $Negated is true, the assertion is inverted.
 */
// oxfmt-ignore
export interface AssertAnyKind extends AssertionKind {
  name: 'any'
  expectationConstraint: unknown
  parameters: [$Actual: unknown, $Negated?: boolean]
  return: AssertAny<this['parameters'][0], this['parameters'][1]>
}

// oxfmt-ignore
export type AssertAny<$Actual, $Negated extends boolean | undefined> = {
  pass: Pass
  fail: StaticErrorAssertion<'Type is not any', any, $Actual>
  negated_pass: StaticErrorAssertion<'Type is any, but expected not any', any, $Actual>
  negated_fail: Pass
}[
  `${NegatedInputToCaseKey<$Negated>}${Ts.IsAny<$Actual> extends true ? 'pass' : 'fail'}`
]

/**
 * Unknown assertion kind - checks if type is `unknown`.
 *
 * Parameters: [$Actual, $Negated?]
 * Returns: never if type is unknown (or not unknown when negated), otherwise StaticErrorAssertion
 *
 * This is the base kind used by all `*.unknown()` assertions.
 * When $Negated is true, the assertion is inverted.
 */
// oxfmt-ignore
export interface AssertUnknownKind extends AssertionKind {
  name: 'unknown'
  expectationConstraint: unknown
  parameters: [$Actual: unknown, $Negated?: boolean]
  return: AssertUnknown<this['parameters'][0], this['parameters'][1]>
}

// oxfmt-ignore
export type AssertUnknown<$Actual, $Negated extends boolean | undefined> = {
  pass: Pass
  fail: StaticErrorAssertion<'Type is not unknown', unknown, $Actual>
  negated_pass: StaticErrorAssertion<'Type is unknown, but expected not unknown', unknown, $Actual>
  negated_fail: Pass
}[
  `${NegatedInputToCaseKey<$Negated>}${Inhabitance.GetCase<$Actual> extends 'unknown' ? 'pass' : 'fail'}`
]

/**
 * Never assertion kind - checks if type is `never`.
 *
 * Part of the Higher-Kinded Types (HKT) pattern.
 *
 * Parameters: [$Actual, $Negated?]
 * Returns: never if type is never (or not never when negated), otherwise StaticErrorAssertion
 *
 * This is the base kind used by all `*.never()` assertions.
 * When $Negated is true, the assertion is inverted.
 */
// oxfmt-ignore
export interface AssertNeverKind extends AssertionKind {
  name: 'never'
  expectationConstraint: unknown
  parameters: [$Actual: unknown, $Negated?: boolean]
  return: AssertNever<this['parameters'][0], this['parameters'][1]>
}

// oxfmt-ignore
export type AssertNever<$Actual, $Negated extends boolean | undefined> = {
  pass: Pass
  fail: StaticErrorAssertion<'Type is not never', never, $Actual>
  negated_pass: StaticErrorAssertion<'Type is never, but expected not never', never, $Actual>
  negated_fail: Pass
}[
  `${NegatedInputToCaseKey<$Negated>}${[$Actual] extends [never] ? 'pass' : 'fail'}`
]

/**
 * Empty assertion kind - checks if type is empty.
 *
 * Part of the Higher-Kinded Types (HKT) pattern.
 *
 * Parameters: [$Actual, $Negated?]
 * Returns: never if type is empty (or not empty when negated), otherwise StaticErrorAssertion
 *
 * This is the base kind used by all `*.empty()` assertions.
 * When $Negated is true, the assertion is inverted.
 *
 * Empty types include:
 * - Empty array: `[]` or `readonly []`
 * - Empty object: `keyof T extends never` (not `{}`!)
 * - Empty string: `''`
 */
// oxfmt-ignore
export interface AssertEmptyKind extends AssertionKind {
  name: 'empty'
  expectationConstraint: unknown
  parameters: [$Actual: unknown, $Negated?: boolean]
  return: AssertEmpty<this['parameters'][0], this['parameters'][1]>
}

// oxfmt-ignore
export type AssertEmpty<$Actual, $Negated extends boolean | undefined> = {
  pass: Pass
  fail: StaticErrorAssertion<
    'Type is not empty',
    EmptyTypes,
    $Actual,
    {
      tip_array: 'Empty array: [] or readonly []'
      tip_object: 'Empty object: keyof T extends never (not {}!)'
      tip_string: 'Empty string: \'\''
    }
  >
  negated_pass: StaticErrorAssertion<'Expected type to not be empty, but was'>
  negated_fail: Pass
}[
  `${NegatedInputToCaseKey<$Negated>}${Inhabitance.IsEmpty<$Actual> extends true ? 'pass' : 'fail'}`
]

/**
 * Union of valid empty types for error display.
 */
type EmptyTypes = [] | Record<PropertyKey, never> | ''

// Helpers

export type Pass = never

interface AssertionKind extends Fn.Kind.Kind {}

/**
 * Convert $Negated parameter to case key prefix.
 *
 * @internal
 */
type NegatedInputToCaseKey<$Negated extends boolean | undefined> = [$Negated] extends [true]
  ? 'negated_'
  : ''

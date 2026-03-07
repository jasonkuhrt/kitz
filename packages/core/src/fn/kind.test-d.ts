/**
 * Type-level tests for Kind.Kind - Issue #52 reproduction
 *
 * Tests that removing readonly from Kind.Kind fixes type inference
 * in complex HKT scenarios where conditional types depend on parameter details.
 *
 * See: https://github.com/jasonkuhrt/kitz/issues/52
 */

import type * as Kind from './kind.js'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Issue #52: Conditional type inference with Kind parameters
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Test case from issue #52: Type function that conditionally transforms based on codec property.
 *
 * This used to fail when Kind.Kind had readonly properties because:
 * 1. The intersection ($Kind & { parameters: Args }) created a conflict
 * 2. this['parameters'] lookups resolved through readonly parameters: unknown BEFORE the intersection
 * 3. Conditional branches couldn't narrow on parameter details
 */
interface StringToDate extends Kind.Kind {
  return: this['parameters'] extends { codec: 'Date' } ? Date : string
}

// ✅ Should infer Date when codec: 'Date'
type _result_with_date_codec = Kind.Apply<StringToDate, { codec: 'Date' }>
const _assert_date: _result_with_date_codec = null as any as Date

// ✅ Should infer string when no codec
type _result_without_codec = Kind.Apply<StringToDate, { codec: 'String' }>
const _assert_string: _result_without_codec = '' as string

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// More complex conditional type scenarios
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Multi-parameter conditional type function
 */
interface Transform extends Kind.Kind {
  return: this['parameters'] extends [infer $T, infer $Mode]
    ? $Mode extends 'upper'
      ? Uppercase<Extract<$T, string>>
      : $Mode extends 'lower'
        ? Lowercase<Extract<$T, string>>
        : $T
    : never
}

type _upper_result = Kind.Apply<Transform, ['hello', 'upper']>
const _test_upper: _upper_result = 'HELLO'

type _lower_result = Kind.Apply<Transform, ['WORLD', 'lower']>
const _test_lower: _lower_result = 'world'

type _passthrough_result = Kind.Apply<Transform, ['test', 'none']>
const _test_passthrough: _passthrough_result = 'test'

/**
 * Nested parameter access
 */
interface ExtractNested extends Kind.Kind {
  return: this['parameters'] extends { data: { value: infer $V } } ? $V : never
}

type _nested_result = Kind.Apply<ExtractNested, { data: { value: 42 } }>
const _test_nested: _nested_result = 42

/**
 * Union type narrowing in parameters
 */
interface FilterType extends Kind.Kind {
  return: this['parameters'] extends [infer $Union, infer $Filter]
    ? Extract<$Union, $Filter>
    : never
}

type _union_filter_result = Kind.Apply<FilterType, [string | number | boolean, string]>
const _test_union_filter: _union_filter_result = '' as string

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Array/Tuple parameter access
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface GetFirst extends Kind.Kind {
  return: this['parameters'] extends readonly [infer $First, ...any[]] ? $First : never
}

type _first_result = Kind.Apply<GetFirst, ['a', 'b', 'c']>
const _test_first: _first_result = 'a'

import type { Type as A } from '#kitz/assert/assert'
import { Ts } from '#ts'
import type { Brand } from 'effect'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Test Setup - Branded Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type NonNegative = number & Brand.Brand<'NonNegative'>

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// StripReadonlyDeep Tests - Tuple Preservation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ⭐ CRITICAL TEST: Tuple structure must be preserved, not widened to union array
// This test reproduces the bug found in num/$.test-d.ts where:
// parameters.sub.ofAs<[b, a]>() was widening [b, a] to (a | b)[]

type _strip_readonly_deep_tuple_preservation = A.Cases<
  // Basic tuple preservation: [1, 2] NOT (1 | 2)[]
  A.exact<Ts.StripReadonlyDeep<readonly [1, 2]>, [1, 2]>,
  // Tuple with different types: [number, string] NOT (number | string)[]
  A.exact<Ts.StripReadonlyDeep<readonly [number, string]>, [number, string]>,
  // Tuple with branded types
  A.exact<Ts.StripReadonlyDeep<readonly [NonNegative, number]>, [NonNegative, number]>,
  // Nested tuple preservation
  A.exact<Ts.StripReadonlyDeep<{ readonly data: readonly [1, 2] }>, { data: [1, 2] }>
>

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// StripReadonlyDeep Tests - Object Readonly Stripping
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type _strip_readonly_deep_object = A.Cases<
  // Basic object
  A.exact<Ts.StripReadonlyDeep<{ readonly x: number; readonly y: string }>, { x: number; y: string }>,
  // Nested object
  A.exact<
    Ts.StripReadonlyDeep<{
      readonly outer: {
        readonly inner: number
      }
    }>,
    {
      outer: {
        inner: number
      }
    }
  >
>

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// StripReadonlyDeep Tests - Array Handling
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type _strip_readonly_deep_array = A.Cases<
  // ReadonlyArray conversion
  A.exact<Ts.StripReadonlyDeep<ReadonlyArray<number>>, Array<number>>,
  // Regular array (passthrough)
  A.exact<Ts.StripReadonlyDeep<Array<number>>, Array<number>>,
  // Nested arrays
  A.exact<Ts.StripReadonlyDeep<ReadonlyArray<ReadonlyArray<string>>>, Array<Array<string>>>
>

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// StripReadonlyDeep Tests - Function Passthrough
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type _strip_readonly_deep_function = A.Cases<
  // Functions should pass through unchanged
  A.exact<Ts.StripReadonlyDeep<(x: readonly string[]) => void>, (x: readonly string[]) => void>
>

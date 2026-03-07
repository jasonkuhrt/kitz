import type { Ts } from '#ts'
import type { O } from 'ts-toolbelt'

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Diff Utilities
//
//
//
//

/**
 * Get the intersection of keys between two object types.
 *
 * Returns a union of keys that exist in both objects.
 * Used for finding shared properties between types.
 *
 * @category Diff
 *
 * @template $A - First object type
 * @template $B - Second object type
 *
 * @example
 * ```ts
 * type A = { a: 1; b: 2; c: 3 }
 * type B = { b: 'x'; c: 'y'; d: 'z' }
 *
 * type Shared = Obj.Diff.SharedKeys<A, B>  // 'b' | 'c'
 * ```
 */
export type SharedKeys<$A extends object, $B extends object> = O.IntersectKeys<$A, $B>

/**
 * Remove specified keys from an object type, with forced evaluation.
 *
 * Similar to TypeScript's built-in `Omit`, but ensures the resulting type
 * is fully evaluated rather than showing as `Omit<T, K>` in error messages.
 * This makes type errors more readable by displaying the actual resulting object type.
 *
 * @category Diff
 *
 * @template $T - The object type to remove keys from
 * @template $Keys - Union of keys to remove
 *
 * @example
 * ```ts
 * type User = { id: string; name: string; email: string; password: string }
 *
 * type Public = Obj.Diff.ExcludeKeys<User, 'password'>
 * // { id: string; name: string; email: string }
 *
 * type Minimal = Obj.Diff.ExcludeKeys<User, 'email' | 'password'>
 * // { id: string; name: string }
 * ```
 *
 * @example
 * ```ts
 * // Difference from Omit - better error messages
 * type WithOmit = Omit<User, 'password'>  // Displays as: Omit<User, "password">
 * type WithExclude = Obj.Diff.ExcludeKeys<User, 'password'>  // Displays as: { id: string; name: string; email: string }
 * ```
 */
export type ExcludeKeys<$T, $Keys> = {
  [k in Exclude<keyof $T, $Keys>]: $T[k]
}

/**
 * Find properties that exist in both object types but have different types.
 *
 * For each shared key, compares the types of the properties. If they differ,
 * returns an object with `{ expected: TypeA, actual: TypeB }` for that key.
 * If types match, returns `never` for that key (which can be filtered out with {@link OmitNever}).
 *
 * @category Diff
 *
 * @template $Expected - The expected object type
 * @template $Actual - The actual object type to compare
 *
 * @example
 * ```ts
 * type Expected = { id: string; name: string; count: number }
 * type Actual = { id: number; name: string; count: string }
 *
 * type Diff = Obj.Diff.Mismatched<Expected, Actual>
 * // {
 * //   id: { expected: string; actual: number }
 * //   name: never  // Types match
 * //   count: { expected: number; actual: string }
 * // }
 * ```
 *
 * @example
 * ```ts
 * // Combined with OmitNever to get only mismatches
 * type OnlyMismatches = Obj.Diff.OmitNever<Obj.Diff.Mismatched<Expected, Actual>>
 * // {
 * //   id: { expected: string; actual: number }
 * //   count: { expected: number; actual: string }
 * // }
 * ```
 */
// oxfmt-ignore
export type Mismatched<$Expected extends object, $Actual extends object> = {
  [k in SharedKeys<$Expected, $Actual>]: k extends keyof $Expected
    ? k extends keyof $Actual
      ? $Expected[k] extends $Actual[k]
        ? $Actual[k] extends $Expected[k]
          ? never
          : { expected: $Expected[k]; actual: $Actual[k] }
        : { expected: $Expected[k]; actual: $Actual[k] }
      : never
    : never
}

/**
 * Remove all properties with `never` type from an object type.
 *
 * Filters out object properties whose values are `never`, leaving only
 * properties with concrete types. Useful for cleaning up conditional
 * type results that use `never` as a sentinel value.
 *
 * @category Diff
 *
 * @template $T - The object type to filter
 *
 * @example
 * ```ts
 * type Mixed = {
 *   keep1: string
 *   remove: never
 *   keep2: number
 *   alsoRemove: never
 * }
 *
 * type Clean = Obj.Diff.OmitNever<Mixed>
 * // { keep1: string; keep2: number }
 * ```
 *
 * @example
 * ```ts
 * // Common pattern: conditional properties
 * type Conditional<T> = {
 *   [K in keyof T]: T[K] extends string ? T[K] : never
 * }
 *
 * type Input = { a: string; b: number; c: string }
 * type OnlyStrings = Obj.Diff.OmitNever<Conditional<Input>>
 * // { a: string; c: string }
 * ```
 */
export type OmitNever<$T> = {
  [k in keyof $T as $T[k] extends never ? never : k]: $T[k]
}

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Tuple Diff Utilities
//
//
//
//

/**
 * Marker type for tuple positions that match (no diff).
 * Used in tuple diffs to indicate positions where expected and actual are the same.
 *
 * @category Diff
 *
 * @example
 * ```ts
 * // In a tuple diff, _ represents positions that match
 * type Diff = [[string, number], Obj.Diff._, [boolean, symbol]]
 * //           ^^^ mismatch       ^^^ match    ^^^ mismatch
 * ```
 */
export type _ = { readonly __match__: unique symbol }

/**
 * Check if a type is a tuple (array with known length).
 *
 * @category Diff
 * @internal
 */
export type IsTuple<$T> = $T extends readonly unknown[]
  ? number extends $T['length']
    ? false
    : true
  : false

/**
 * Extract numeric string keys from a tuple type (0, 1, 2, etc.).
 * Filters out array prototype methods and symbols.
 *
 * @category Diff
 * @internal
 */
export type TupleNumericKeys<$T extends readonly unknown[]> = Extract<keyof $T, `${number}`>

/**
 * Check if number A is greater than number B by recursively building an array.
 *
 * @category Diff
 * @internal
 */
type IsLonger<
  $A extends number,
  $B extends number,
  ___Acc extends unknown[] = [],
> = ___Acc['length'] extends $A
  ? false // Reached A first, so A <= B
  : ___Acc['length'] extends $B
    ? true // Reached B first, so A > B
    : IsLonger<$A, $B, [...___Acc, unknown]>

/**
 * Transform tuple mismatch object to array format with [expected, actual] pairs and _ markers.
 *
 * @category Diff
 * @internal
 *
 * @example
 * ```ts
 * // Input: { 0: { expected: string; actual: number }, 1: never, 2: { expected: boolean; actual: symbol } }
 * // Output: [[string, number], _, [boolean, symbol]]
 * ```
 */
// oxfmt-ignore
export type TupleMismatchToArray<
  $Mismatch extends Record<string, any>,
  $Length extends number
> = TupleMismatchToArrayHelper<$Mismatch, $Length, []>

// oxfmt-ignore
type TupleMismatchToArrayHelper<
  $Mismatch extends Record<string, any>,
  $Length extends number,
  $Acc extends unknown[]
> =
  $Acc['length'] extends $Length
    ? $Acc
    : `${$Acc['length']}` extends keyof $Mismatch
      ? [$Mismatch[`${$Acc['length']}`]] extends [never]
        ? TupleMismatchToArrayHelper<$Mismatch, $Length, [...$Acc, _]>
        : $Mismatch[`${$Acc['length']}`] extends { expected: infer __expected__; actual: infer __actual__ }
          ? TupleMismatchToArrayHelper<$Mismatch, $Length, [...$Acc, [__expected__, __actual__]]>
          : TupleMismatchToArrayHelper<$Mismatch, $Length, [...$Acc, _]>
      : TupleMismatchToArrayHelper<$Mismatch, $Length, [...$Acc, _]>

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • IsEmpty
//
//
//
//

/**
 * Type-level check to determine if an object type has no keys or if an array has length 0.
 *
 * @category Diff
 *
 * @example
 * ```ts
 * type Empty = Obj.Diff.IsEmpty<{}> // true
 * type NotEmpty = Obj.Diff.IsEmpty<{ a: 1 }> // false
 * type EmptyArray = Obj.Diff.IsEmpty<[]> // true
 * type NonEmptyArray = Obj.Diff.IsEmpty<[1, 2]> // false
 * ```
 */
export type IsEmpty<$T> = $T extends readonly unknown[]
  ? $T['length'] extends 0
    ? true
    : false
  : $T extends object
    ? keyof $T extends never
      ? true
      : false
    : false

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Main Diff Computation
//
//
//
//

/**
 * Compute a structured diff between two types showing missing, excess, and mismatched fields.
 *
 * Creates a detailed comparison that shows:
 * - `diff_missing__`: Fields in expected but not in actual
 * - `diff_excess___`: Fields in actual but not in expected
 * - `diff_mismatch_`: Fields with different types between expected and actual
 *
 * Empty diff categories are automatically omitted from the result.
 *
 * **Object Diffs**: Show as nested objects with property names
 * **Tuple Diffs**: Show as arrays with `[expected, actual]` pairs and {@link _} for matches
 *
 * @category Diff
 *
 * @template $Expected - The expected type
 * @template $Actual - The actual type
 * @template $Prefix - Prefix for diff field names (defaults to 'diff')
 *
 * @example
 * ```ts
 * // Object diff
 * type Expected = { a: string; b: number }
 * type Actual = { b: string; c: boolean }
 *
 * type Diff = Obj.Diff.Compute<Expected, Actual>
 * // {
 * //   diff_missing__: { a: string }
 * //   diff_excess___: { c: boolean }
 * //   diff_mismatch_: { b: { expected: number; actual: string } }
 * // }
 * ```
 *
 * @example
 * ```ts
 * // Tuple diff
 * type Expected = [1, string, boolean]
 * type Actual = [0, string, symbol]
 *
 * type Diff = Obj.Diff.Compute<Expected, Actual>
 * // {
 * //   diff_mismatch_: [[1, 0], Obj.Diff._, [boolean, symbol]]
 * // }
 * ```
 */
// oxfmt-ignore
export type Compute<
  $Expected,
  $Actual,
  $Prefix extends string = 'diff'
> =
  $Expected extends object
    ? $Actual extends object
      ? {
          [k in keyof ComputeDiffFields<$Expected, $Actual> as IsEmpty<ComputeDiffFields<$Expected, $Actual>[k]> extends true ? never : k extends string ? `${$Prefix}_${k}` : k]: ComputeDiffFields<$Expected, $Actual>[k]
        }
      : {}
    : {}

/**
 * Alias for {@link Compute}.
 * @category Diff
 */
export type ComputeDiff<$Expected, $Actual, $Prefix extends string = 'diff'> = Compute<
  $Expected,
  $Actual,
  $Prefix
>

// oxfmt-ignore
type ComputeDiffFields<$Expected extends object, $Actual extends object> =
  IsTuple<$Expected> extends true
    ? IsTuple<$Actual> extends true
      ? ComputeDiffFieldsTuple<$Expected & readonly unknown[], $Actual & readonly unknown[]>
      : ComputeDiffFieldsObject<$Expected, $Actual>
    : ComputeDiffFieldsObject<$Expected, $Actual>

// oxfmt-ignore
type ComputeDiffFieldsObject<$Expected extends object, $Actual extends object> = {
  missing__: Ts.Simplify.All<ExcludeKeys<$Expected, SharedKeys<$Expected, $Actual>>>
  excess___: Ts.Simplify.All<ExcludeKeys<$Actual, SharedKeys<$Expected, $Actual>>>
  mismatch_: Ts.Simplify.All<OmitNever<Mismatched<$Expected, $Actual>>>
}

// oxfmt-ignore
type ComputeDiffFieldsTuple<
  $Expected extends readonly unknown[],
  $Actual extends readonly unknown[]
> = {
  missing__: TupleMissingToArray<$Expected, $Actual>
  excess___: TupleExcessToArray<$Expected, $Actual>
  mismatch_: FilterTupleMismatch<Mismatched<$Expected, $Actual>> extends infer __filtered__
    ? __filtered__ extends Record<string, any>
      ? HasAnyMismatch<__filtered__> extends true
        ? TupleMismatchToArray<
            __filtered__,
            $Expected['length'] extends $Actual['length'] ? $Expected['length'] : $Expected['length'] extends number ? $Actual['length'] extends number ? $Expected['length'] : never : never
          >
        : []
      : []
    : []
}

// oxfmt-ignore
type FilterTupleMismatch<$Mismatch extends object> = {
  [k in TupleNumericKeys<$Mismatch & readonly unknown[]>]: k extends keyof $Mismatch ? $Mismatch[k] : never
}

/**
 * Check if a filtered mismatch object has any non-never values.
 * Returns false if all values are never, true otherwise.
 *
 * @category Diff
 * @internal
 */
type HasAnyMismatch<$Filtered extends Record<string, any>> = {
  [k in keyof $Filtered]: $Filtered[k] extends never ? false : true
}[keyof $Filtered] extends false
  ? false
  : true

// oxfmt-ignore
type TupleMissingToArray<
  $Expected extends readonly unknown[],
  $Actual extends readonly unknown[]
> =
  $Expected['length'] extends $Actual['length']
    ? []
    : $Expected['length'] extends number
      ? $Actual['length'] extends number
        ? IsLonger<$Expected['length'], $Actual['length']> extends true
          ? TupleMissingToArrayHelper<$Expected, $Actual, $Actual['length'], []>
          : []
        : []
      : []

// oxfmt-ignore
type TupleMissingToArrayHelper<
  $Expected extends readonly unknown[],
  $Actual extends readonly unknown[],
  $ActualLength extends number,
  $Acc extends unknown[]
> =
  $Acc['length'] extends $Expected['length']
    ? $Acc
    : IsLonger<$ActualLength, $Acc['length']> extends true
      ? TupleMissingToArrayHelper<$Expected, $Actual, $ActualLength, [...$Acc, _]>
      : TupleMissingToArrayHelper<$Expected, $Actual, $ActualLength, [...$Acc, $Expected[$Acc['length']]]>

// oxfmt-ignore
type TupleExcessToArray<
  $Expected extends readonly unknown[],
  $Actual extends readonly unknown[]
> =
  $Actual['length'] extends $Expected['length']
    ? []
    : $Expected['length'] extends number
      ? $Actual['length'] extends number
        ? IsLonger<$Actual['length'], $Expected['length']> extends true
          ? TupleExcessToArrayHelper<$Expected, $Actual, $Expected['length'], []>
          : []
        : []
      : []

// oxfmt-ignore
type TupleExcessToArrayHelper<
  $Expected extends readonly unknown[],
  $Actual extends readonly unknown[],
  $ExpectedLength extends number,
  $Acc extends unknown[]
> =
  $Acc['length'] extends $Actual['length']
    ? $Acc
    : IsLonger<$ExpectedLength, $Acc['length']> extends true
      ? TupleExcessToArrayHelper<$Expected, $Actual, $ExpectedLength, [...$Acc, _]>
      : TupleExcessToArrayHelper<$Expected, $Actual, $ExpectedLength, [...$Acc, $Actual[$Acc['length']]]>

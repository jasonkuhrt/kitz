/**
 * Valid values for discriminant properties in tagged unions.
 */
export type DiscriminantPropertyValue = string | number | symbol

/**
 * Marker type to make forced union distribution explicit and self-documenting.
 *
 * TypeScript distributes unions in conditional types when the checked type is a naked type parameter.
 * Using this marker in your conditional type makes the intent explicit to readers.
 *
 * @example
 * ```ts
 * // Without marker - unclear if distribution is intentional
 * type Transform<T> = T extends string ? Uppercase<T> : T
 *
 * // With marker - explicitly documents that distribution is desired
 * type Transform<T> = T extends __FORCE_DISTRIBUTION__ ? T extends string ? Uppercase<T> : T : never
 *
 * // More typical usage pattern
 * type MapUnion<T> = T extends __FORCE_DISTRIBUTION__
 *   ? TransformSingleMember<T>
 *   : never
 * ```
 *
 * @example
 * ```ts
 * // Real-world example: mapping over union members
 * type AddPrefix<T> = T extends __FORCE_DISTRIBUTION__
 *   ? T extends string ? `prefix_${T}` : T
 *   : never
 *
 * type Result = AddPrefix<'a' | 'b' | 'c'>
 * // 'prefix_a' | 'prefix_b' | 'prefix_c'
 * ```
 */
export type __FORCE_DISTRIBUTION__ = any

/**
 * Include only types that extend a constraint (opposite of Exclude).
 * Filters a union type to only include members that extend the constraint.
 *
 * @example
 * ```ts
 * type T = Union.Include<string | number | boolean, string | number>  // string | number
 * type T2 = Union.Include<'a' | 'b' | 1 | 2, string>  // 'a' | 'b'
 * ```
 */
export type Include<$T, $U> = $T extends $U ? $T : never

/**
 * Convert a union type to a tuple type.
 *
 * @example
 * ```ts
 * type T = Union.ToTuple<'a' | 'b' | 'c'>  // ['a', 'b', 'c']
 * ```
 */
export type ToTuple<
  $Union,
  ___L = LastOf<$Union>,
  ___N = [$Union] extends [never] ? true : false,
> = true extends ___N ? [] : [...ToTuple<Exclude<$Union, ___L>>, ___L]

/**
 * Convert a union type to an intersection type.
 *
 * @example
 * ```ts
 * type U = { a: string } | { b: number }
 * type I = Union.ToIntersection<U>  // { a: string } & { b: number }
 * ```
 */
export type ToIntersection<$U> = ($U extends any ? (k: $U) => void : never) extends (
  k: infer __i__,
) => void
  ? __i__
  : never

/**
 * Get the last type in a union.
 *
 * @example
 * ```ts
 * type T = Union.LastOf<'a' | 'b' | 'c'>  // 'c'
 * ```
 */
export type LastOf<$T> =
  ToIntersection<$T extends any ? () => $T : never> extends () => infer __r__ ? __r__ : never

/**
 * Force union distribution in conditional types.
 *
 * @example
 * ```ts
 * type T = Union.Expanded<'a' | 'b'>  // 'a' | 'b' (forced distribution)
 * ```
 */
export type Expanded<$Union> = $Union

/**
 * Union that ignores any and unknown.
 */
export type IgnoreAnyOrUnknown<$T> = unknown extends $T ? never : $T

/**
 * Check if any member of a union extends a type.
 *
 * @example
 * ```ts
 * type T1 = Union.IsAnyMemberExtends<string | number, string>  // true
 * type T2 = Union.IsAnyMemberExtends<number | boolean, string>  // false
 * ```
 */
// oxfmt-ignore
export type IsAnyMemberExtends<$Union, $Type> =
  (
    // [1] Force distribution
    $Union extends any ?
      ($Union /* member */ extends $Type ? true : false) :
      never // [1]
  ) extends false
    ? false
    : true

/**
 * Checks if a union type contains a specific type.
 *
 * Returns `true` if any member of the union type extends the target type,
 * `false` otherwise. This is useful for conditional type logic based on
 * union membership.
 *
 * @template $Type - The union type to search within
 * @template $LookingFor - The type to search for
 *
 * @example
 * ```ts
 * type HasString = Union.IsHas<string | number | boolean, string>  // true
 * type HasDate = Union.IsHas<string | number, Date>                // false
 * type HasLiteral = Union.IsHas<'a' | 'b' | 'c', 'b'>             // true
 *
 * // Useful in conditional types
 * type ProcessValue<T> = Union.IsHas<T, Promise<any>> extends true
 *   ? 'async'
 *   : 'sync'
 *
 * type R1 = ProcessValue<string | Promise<string>>  // 'async'
 * type R2 = ProcessValue<string | number>           // 'sync'
 * ```
 *
 * @example
 * ```ts
 * // Works with complex types
 * type Events = { type: 'click' } | { type: 'hover' } | { type: 'focus' }
 * type HasClick = Union.IsHas<Events, { type: 'click' }>  // true
 *
 * // Check for any promise in union
 * type MaybeAsync<T> = Union.IsHas<T, Promise<any>>
 * type R3 = MaybeAsync<string | Promise<number>>  // true
 * type R4 = MaybeAsync<string | number>           // false
 * ```
 */
// oxfmt-ignore
export type IsHas<$Type, $LookingFor> =
  _IsHas<$Type, $LookingFor> extends false
    ? false
    : true

// oxfmt-ignore
type _IsHas<$Type, $LookingFor> =
  $Type extends $LookingFor
    ? true
    : false

/**
 * Merge all members of a union into a single type.
 *
 * @example
 * ```ts
 * type U = { a: string } | { b: number }
 * type M = Union.Merge<U>  // { a: string; b: number }
 * ```
 */
export type Merge<$U> = {
  [k in $U extends any ? keyof $U : never]: $U extends any
    ? k extends keyof $U
      ? $U[k]
      : never
    : never
}

/**
 * Check if a type is a union type.
 *
 * Returns `true` if the type is a union with multiple members, `false` if it's
 * a single type or `never`. This is useful for conditional type logic that needs
 * to handle unions differently from single types.
 *
 * The check works by:
 * 1. First checking if the type is `never` (not a union)
 * 2. Then checking if converting the type to an intersection yields the same type
 *    (single types remain unchanged when converted to intersection, unions do not)
 *
 * @example
 * ```ts
 * // Union types return true
 * type T1 = Union.Is<string | number>              // true
 * type T2 = Union.Is<'a' | 'b' | 'c'>             // true
 * type T3 = Union.Is<{ a: 1 } | { b: 2 }>         // true
 *
 * // Single types return false
 * type T4 = Union.Is<string>                       // false
 * type T5 = Union.Is<number>                       // false
 * type T6 = Union.Is<{ a: string }>               // false
 *
 * // Special cases
 * type T7 = Union.Is<never>                        // false
 * type T8 = Union.Is<any>                          // false
 * ```
 *
 * @example
 * ```ts
 * // Conditional logic based on union detection
 * type ProcessType<T> = Union.Is<T> extends true
 *   ? 'multiple options'
 *   : 'single option'
 *
 * type R1 = ProcessType<string | number>  // 'multiple options'
 * type R2 = ProcessType<string>           // 'single option'
 * ```
 */
// oxfmt-ignore
export type Is<$Type> =
  [$Type] extends [never]                   ? false :
  [$Type] extends [ToIntersection<$Type>]   ? false :
                                              true

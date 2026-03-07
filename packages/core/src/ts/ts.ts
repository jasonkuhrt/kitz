import type { Str } from '#str'
import type { Brand } from 'effect'
import type { GetPreservedTypes } from './global-settings.ts'
import type { IsAny, IsNever, IsUnknown } from './inhabitance.js'
import type { Display } from './traits/display.js'

// Re-export error utilities
export type * as Err from './err.js'

// Re-export inhabitance utilities
export type { IsAny, IsNever, IsUnknown } from './inhabitance.js'

/**
 * Cast any value to a specific type for testing purposes.
 * Useful for type-level testing where you need to create a value with a specific type.
 *
 * @template $value - The type to cast to
 * @param value - The value to cast (defaults to undefined)
 * @returns The value cast to the specified type
 *
 * @example
 * ```ts
 * // Creating typed test values
 * const user = as<{ id: string; name: string }>({ id: '1', name: 'Alice' })
 *
 * // Testing type inference
 * declare let _: any
 * const result = someFunction()
 * assertExtends<string>()(_ as typeof result)
 * ```
 *
 * @category Utilities
 */
export const as = <$value>(value?: unknown): $value => value as any

/**
 * Types that TypeScript accepts being interpolated into a Template Literal Type.
 *
 * These are the types that can be used within template literal types without causing
 * a TypeScript error. When a value of one of these types is interpolated into a
 * template literal type, TypeScript will properly convert it to its string representation.
 *
 * @example
 * ```ts
 * // All these types can be interpolated:
 * type Valid1 = `Value: ${string}`
 * type Valid2 = `Count: ${number}`
 * type Valid3 = `Flag: ${boolean}`
 * type Valid4 = `ID: ${123n}`
 *
 * // Example usage in conditional types:
 * type Stringify<T extends Interpolatable> = `${T}`
 * type Result1 = Stringify<42>        // "42"
 * type Result2 = Stringify<true>      // "true"
 * type Result3 = Stringify<'hello'>   // "hello"
 * ```
 *
 * @category Type Utilities
 */
export type Interpolatable = string | number | bigint | boolean | null | undefined | symbol | object

/**
 * Represents a type error that can be surfaced at the type level.
 *
 * This is useful for providing more informative error messages directly in TypeScript's
 * type checking, often used with conditional types or generic constraints. When TypeScript
 * encounters this type, it will display the error information in a structured way.
 *
 * @template $Message - A string literal type describing the error
 * @template $Context - An object type providing additional context about the error,
 *                      often including the types involved
 * @template $Hint - A string literal type providing a hint for resolving the error
 *
 * @example
 * ```ts
 * // Creating a custom type error
 * type RequireString<T> = T extends string ? T : StaticError<
 *   'Type must be a string',
 *   { Received: T },
 *   'Consider using string or a string literal type'
 * >
 *
 * type Good = RequireString<'hello'>  // 'hello'
 * type Bad = RequireString<number>    // StaticError<...>
 * ```
 *
 * @example
 * ```ts
 * // Using in function constraints
 * function processString<T>(
 *   value: T extends string ? T : StaticError<
 *     'Argument must be a string',
 *     { ProvidedType: T }
 *   >
 * ): void {
 *   // Implementation
 * }
 *
 * processString('hello')  // OK
 * processString(42)       // Type error with custom message
 * ```
 *
 * @category Utils
 */

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Tuple Utilities
//
//
//
//

/**
 * Convert a tuple of strings into lettered fields.
 *
 * Transforms `[string, string, ...]` into `{ tip_a: string, tip_b: string, ... }`.
 * Useful for displaying multiple pieces of metadata with alphabetic labels.
 *
 * @template $Values - Readonly array of strings
 * @template $Prefix - Prefix for the field names (defaults to 'tip')
 *
 * @example
 * ```ts
 * type T1 = TupleToLettered<['First', 'Second']>
 * // { tip_a: 'First', tip_b: 'Second' }
 *
 * type T2 = TupleToLettered<['Only one']>
 * // { tip_a: 'Only one' }
 *
 * // Custom prefix
 * type T3 = TupleToLettered<['A', 'B'], 'item'>
 * // { item_a: 'A', item_b: 'B' }
 * ```
 *
 * @category Type Utilities
 */
export type TupleToLettered<$Values extends readonly string[], $Prefix extends string = 'tip'> = {
  [i in keyof $Values as i extends `${infer __n__ extends number}`
    ? `${$Prefix}_${Str.Char.LettersLower[__n__]}`
    : never]: $Values[i]
}

/**
 * Like {@link Display} but adds additional styling to display the rendered type in a sentence.
 *
 * Useful for type-level error messages where you want to clearly distinguish type names
 * from surrounding text. Wraps the displayed type with backticks (\`) like inline code in Markdown.
 *
 * @template $Type - The type to format and display
 *
 * @example
 * ```ts
 * type Message1 = `Expected ${Show<string>} but got ${Show<number>}`
 * // Result: "Expected `string` but got `number`"
 *
 * type Message2 = `The type ${Show<'hello' | 'world'>} is not assignable`
 * // Result: "The type `'hello' | 'world'` is not assignable"
 *
 * // Using in error messages
 * type TypeError<Expected, Actual> = StaticError<
 *   `Type mismatch: expected ${Show<Expected>} but got ${Show<Actual>}`,
 *   { Expected, Actual }
 * >
 * ```
 *
 * @category Type Display
 */
export type Show<$Type> = `\`${Display<$Type>}\``

/**
 * Version of {@link Show} but uses single quotes instead of backticks.
 *
 * This can be useful in template literal types where backticks would be rendered as "\`"
 * which is not ideal for readability. Use this when the output will be used within
 * another template literal type or when backticks cause display issues.
 *
 * Note that when working with TS-level errors, if TS can instantiate all the types involved then
 * the result will be a string, not a string literal type. So when working with TS-level errors,
 * only reach for this variant of {@link Show} if you think there is likelihood that types won't be instantiated.
 *
 * @template $Type - The type to format and display
 *
 * @example
 * ```ts
 * // When backticks would be escaped in output
 * type ErrorInTemplate = `Error: ${ShowInTemplate<string>} is required`
 * // Result: "Error: 'string' is required"
 *
 * // Comparing Show vs ShowInTemplate
 * type WithShow = `Type is ${Show<number>}`
 * // May display as: "Type is \`number\`" (escaped backticks)
 *
 * type WithShowInTemplate = `Type is ${ShowInTemplate<number>}`
 * // Displays as: "Type is 'number'" (cleaner)
 * ```
 *
 * @category Type Display
 */
export type ShowInTemplate<$Type> = `'${Display<$Type>}'`

/**
 * Utilities for working with union types at the type level.
 */
/**
 * Type-level helper that ensures a type exactly matches a constraint.
 *
 * Unlike standard `extends`, this requires bidirectional compatibility:
 * the input must extend the constraint AND the constraint must extend the input.
 * This enforces exact type matching without allowing excess properties.
 *
 * @template $Input - The input type to check
 * @template $Constraint - The constraint type that must be exactly matched
 *
 * @example
 * ```ts
 * type User = { name: string; age: number }
 *
 * // Standard extends allows excess properties
 * type T1 = { name: string; age: number; extra: boolean } extends User ? true : false  // true
 *
 * // ExtendsExact requires exact match
 * type T2 = ExtendsExact<{ name: string; age: number; extra: boolean }, User>  // never
 * type T3 = ExtendsExact<{ name: string; age: number }, User>  // { name: string; age: number }
 * type T4 = ExtendsExact<{ name: string }, User>  // never (missing property)
 * ```
 *
 * @example
 * ```ts
 * // Useful for strict function parameters
 * function updateUser<T>(user: ExtendsExact<T, User>): void {
 *   // Only accepts objects that exactly match User type
 * }
 *
 * updateUser({ name: 'Alice', age: 30 })  // OK
 * updateUser({ name: 'Bob', age: 25, extra: true })  // Type error
 * ```
 */
// oxfmt-ignore
export type ExtendsExact<$Input, $Constraint> =
  $Input extends $Constraint
    ? $Constraint extends $Input
      ? $Input
      : never
    : never

/**
 * Type-level utility that checks if a type does NOT extend another type.
 *
 * Returns `true` if type A does not extend type B, `false` otherwise.
 * Useful for conditional type logic where you need to check the absence
 * of a type relationship.
 *
 * @template $A - The type to check
 * @template $B - The type to check against
 * @returns `true` if $A does not extend $B, `false` otherwise
 *
 * @example
 * ```ts
 * type T1 = NotExtends<string, number>      // true (string doesn't extend number)
 * type T2 = NotExtends<'hello', string>     // false ('hello' extends string)
 * type T3 = NotExtends<42, number>          // false (42 extends number)
 * type T4 = NotExtends<{ a: 1 }, { b: 2 }>  // true (different properties)
 * ```
 *
 * @example
 * ```ts
 * // Using in conditional types for optional handling
 * type VarBuilderToType<$Type, $VarBuilder> =
 *   $VarBuilder['required'] extends true                     ? Exclude<$Type, undefined> :
 *   NotExtends<$VarBuilder['default'], undefined> extends true ? $Type | undefined :
 *                                                               $Type
 *
 * // If default is undefined, type is just $Type
 * // If default is not undefined, type is $Type | undefined
 * ```
 *
 * @example
 * ```ts
 * // Checking for specific type exclusions
 * type SafeDivide<T> = NotExtends<T, 0> extends true
 *   ? number
 *   : StaticError<'Cannot divide by zero'>
 *
 * type Result1 = SafeDivide<5>   // number
 * type Result2 = SafeDivide<0>   // StaticError<'Cannot divide by zero'>
 * ```
 */
export type NotExtends<$A, $B> = [$A] extends [$B] ? false : true

/**
 * Assert that a type extends a constraint, returning the type if valid, `never` otherwise.
 *
 * This is a type-level assertion utility useful for enforcing constraints in conditional types.
 * Unlike standard `extends` clauses, this allows you to "assert" a constraint and get back
 * the original type or `never` for use in further type logic.
 *
 * @template $Type - The type to check
 * @template $Constraint - The constraint that $Type must extend
 * @returns `$Type` if it extends `$Constraint`, otherwise `never`
 *
 * @example
 * ```ts
 * type T1 = AssertExtends<string, string>     // string
 * type T2 = AssertExtends<'hello', string>    // 'hello'
 * type T3 = AssertExtends<number, string>     // never
 * type T4 = AssertExtends<42, number>         // 42
 * ```
 *
 * @example
 * ```ts
 * // Using in type-level logic
 * type EnsureArray<T> = AssertExtends<T, any[]>
 *
 * type Valid = EnsureArray<string[]>    // string[]
 * type Invalid = EnsureArray<string>    // never
 * ```
 *
 * @category Type Utilities
 */
// oxfmt-ignore
export type AssertExtends<$Type, $Constraint> =
  $Type extends $Constraint
    ? $Type
    : never

/**
 * Assert that a type extends `object`.
 * Convenience wrapper around {@link AssertExtends} for object types.
 *
 * @template $Type - The type to check
 * @returns `$Type` if it extends `object`, otherwise `never`
 *
 * @example
 * ```ts
 * type T1 = AssertExtendsObject<{ x: number }>  // { x: number }
 * type T2 = AssertExtendsObject<string[]>       // string[]
 * type T3 = AssertExtendsObject<string>         // never
 * type T4 = AssertExtendsObject<number>         // never
 * ```
 *
 * @category Type Utilities
 */
// oxfmt-ignore
export type AssertExtendsObject<$Type> = AssertExtends<$Type, object>

/**
 * Assert that a type extends `string`.
 * Convenience wrapper around {@link AssertExtends} for string types.
 *
 * @template $Type - The type to check
 * @returns `$Type` if it extends `string`, otherwise `never`
 *
 * @example
 * ```ts
 * type T1 = AssertExtendsString<string>      // string
 * type T2 = AssertExtendsString<'hello'>     // 'hello'
 * type T3 = AssertExtendsString<number>      // never
 * type T4 = AssertExtendsString<boolean>     // never
 * ```
 *
 * @category Type Utilities
 */
export type AssertExtendsString<$Type> = AssertExtends<$Type, string>

/**
 * Make all properties in an object mutable (removes readonly modifiers).
 *
 * @example
 * ```ts
 * type Readonly = { readonly x: number; readonly y: string }
 * type Mutable = Writeable<Readonly>  // { x: number; y: string }
 * ```
 */
export type Writeable<$Object> = {
  -readonly [k in keyof $Object]: $Object[k]
}

/**
 * Matches any primitive value type.
 *
 * Primitive values are the basic building blocks of JavaScript that are not objects.
 * This includes all value types that are not Objects, Functions, or Arrays.
 *
 * @example
 * ```ts
 * type T1 = Primitive extends string ? true : false        // true
 * type T2 = Primitive extends { x: number } ? true : false // false
 *
 * // Use in conditional types
 * type StripPrimitives<T> = T extends Primitive ? never : T
 * ```
 *
 * @category Type Utilities
 */
export type Primitive = null | undefined | string | number | boolean | symbol | bigint

/**
 * Structural pattern matching any Effect-branded primitive type.
 *
 * This type matches primitives that have been branded using Effect's {@link https://effect.website/docs/guides/schema/branded-types/ Brand system},
 * by structurally checking for the presence of the `BrandTypeId` symbol property. It's used in
 * {@link KITZ.Ts.PreserveTypes} to prevent branded types from being expanded
 * in type displays and error messages.
 *
 * **How it works:**
 *
 * Effect's branded types follow this pattern:
 * ```ts
 * type NonNegative = number & Brand.Brand<'NonNegative'>
 * // Which expands to:
 * // number & { readonly [BrandTypeId]: { readonly NonNegative: "NonNegative" } }
 * ```
 *
 * The check `T extends { readonly [BrandTypeId]: any }` structurally matches the brand part
 * while plain primitives fail the check since they lack the symbol property.
 *
 * @example
 * ```ts
 * import type { Brand } from 'effect'
 *
 * type NonNegative = number & Brand.Brand<'NonNegative'>
 * type Int = number & Brand.Brand<'Int'>
 *
 * // Branded types match
 * type Test1 = NonNegative extends PrimitiveBrandLike ? true : false  // true
 * type Test2 = Int extends PrimitiveBrandLike ? true : false          // true
 *
 * // Plain primitives don't match
 * type Test3 = number extends PrimitiveBrandLike ? true : false       // false
 * type Test4 = string extends PrimitiveBrandLike ? true : false       // false
 * ```
 *
 * @category Type Utilities
 * @see {@link KITZ.Ts.PreserveTypes}
 */
export type PrimitiveBrandLike = { readonly [Brand.BrandTypeId]: any }

/**
 * Recursively make all properties writable (removes readonly modifiers deeply).
 *
 * Handles functions, primitives, built-ins, and branded types correctly by passing them through.
 * Only recursively processes plain objects and tuples/arrays.
 *
 * Unlike type-fest's WritableDeep, this implementation properly handles function types
 * during TypeScript inference, preventing inference failures that result in `unknown`.
 *
 * Built-in types (primitives, Date, RegExp, etc.) are checked FIRST to handle branded types
 * like `number & { [Brand]: true }`, which extend both `number` and `object`.
 *
 * @template $T - The type to recursively make writable
 *
 * @example
 * ```ts
 * // Primitives and built-ins pass through
 * type N = WritableDeep<number>  // number
 * type D = WritableDeep<Date>    // Date
 *
 * // Branded types pass through (checked before object)
 * type Branded = number & { [brand]: true }
 * type Result = WritableDeep<Branded>  // number & { [brand]: true }
 *
 * // Functions pass through unchanged
 * type Fn = (x: readonly string[]) => void
 * type Result2 = WritableDeep<Fn>  // (x: readonly string[]) => void
 *
 * // Objects are recursively processed
 * type Obj = { readonly a: { readonly b: number } }
 * type Result3 = WritableDeep<Obj>  // { a: { b: number } }
 *
 * // Arrays/tuples are recursively processed
 * type Arr = readonly [readonly string[], readonly number[]]
 * type Result4 = WritableDeep<Arr>  // [string[], number[]]
 * ```
 *
 * @category Type Utilities
 */
// oxfmt-ignore
export type WritableDeep<$T> =
  // Built-ins checked FIRST - handles branded types like `number & { [Brand]: true }`
  $T extends Primitive | void | Date | RegExp ? $T
    : $T extends (...args: any[]) => any ? $T  // Functions pass through
    : $T extends readonly any[] ? { -readonly [i in keyof $T]: WritableDeep<$T[i]> }  // Arrays/tuples
    : $T extends object ? { -readonly [k in keyof $T]: WritableDeep<$T[k]> }  // Objects
    : $T // Fallback (should not be reached)

/**
 * Recursively strip readonly modifiers from a type.
 *
 * Strips `readonly` from objects, tuples, and arrays while recursing into nested structures.
 * Uses inline simplification (`& unknown`) to avoid wrapper type names in error messages.
 *
 * Automatically preserves types registered in {@link KITZ.Ts.PreserveTypes}
 * (including built-in types like Date, Error, Function, and branded primitives).
 *
 * **CRITICAL**: Handles tuples BEFORE arrays to preserve tuple structure.
 * Without tuple handling, `[1, 2]` would match `Array<infer element>` and widen to `(1 | 2)[]`.
 *
 * @template $T - The type to strip readonly from
 *
 * @example
 * ```ts
 * // Object with readonly properties
 * type ReadonlyObj = { readonly x: number; readonly y: string }
 * type Mutable = StripReadonlyDeep<ReadonlyObj>
 * // { x: number; y: string }
 *
 * // Readonly tuple
 * type ReadonlyTuple = readonly [1, 2, 3]
 * type MutableTuple = StripReadonlyDeep<ReadonlyTuple>
 * // [1, 2, 3]
 *
 * // Readonly array
 * type ReadonlyArr = ReadonlyArray<number>
 * type MutableArr = StripReadonlyDeep<ReadonlyArr>
 * // Array<number>
 *
 * // Nested structures with branded types
 * type NonNegative = number & Brand.Brand<'NonNegative'>
 * type Nested = { readonly data: readonly [NonNegative, 1, 2] }
 * type NestedMutable = StripReadonlyDeep<Nested>
 * // { data: [NonNegative, 1, 2] } - branded type preserved!
 * ```
 *
 * @category Type Utilities
 */
// oxfmt-ignore
export type StripReadonlyDeep<$T> =
  $T extends Function ? $T
  // TUPLE HANDLING: Must come before Array AND before GetPreservedTypes to preserve structure
  : $T extends readonly [...infer ___Elements]
    ? { -readonly [i in keyof ___Elements]: StripReadonlyDeep<___Elements[i]> }
  // Array handling (only matches non-tuple arrays now)
  : $T extends Array<infer __element__> ? Array<StripReadonlyDeep<__element__>>
  : $T extends ReadonlyArray<infer __element__> ? Array<StripReadonlyDeep<__element__>>
  // Preserve types from settings AFTER array/tuple handling (branded primitives, built-ins, user-registered)
  : $T extends GetPreservedTypes ? $T
  : $T extends object
    ? { -readonly [k in keyof $T]: StripReadonlyDeep<$T[k]> }
    : $T

/**
 * @deprecated - Commented out 2025-01-07
 *
 * This utility was too strict - requires BIDIRECTIONAL extends, which rejects
 * valid narrowed types (e.g., { id: true } for { id: boolean }).
 *
 * Use Obj.NoExcess instead, which:
 * - ✓ Rejects excess properties (what you want)
 * - ✓ Allows valid subtypes/narrowing (what you need)
 *
 * If a use case for true bidirectional exact matching emerges, uncomment.
 * Otherwise, remove after 3-6 months (target: ~2025-07-01).
 *
 * Original implementation:
 */
// export type ExtendsExact<$Input, $Constraint> =
//   $Input extends $Constraint
//     ? $Constraint extends $Input
//       ? $Input
//       : never
//     : never

// /**
//  * Alias for {@link ExtendsExact}.
//  * Requires exact type matching without excess properties.
//  */

/**
 * Conditional type with else branch.
 *
 * @example
 * ```ts
 * type T = IfExtendsElse<string, string, 'yes', 'no'>  // 'yes'
 * ```
 */
export type IfExtendsElse<$Type, $Extends, $Then, $Else> = $Type extends $Extends ? $Then : $Else

/**
 * Convert a boolean type to a string literal 'true' or 'false'.
 * Useful for lookup table indexing.
 *
 * @example
 * ```ts
 * type T1 = BooleanCase<true>   // 'true'
 * type T2 = BooleanCase<false>  // 'false'
 *
 * // Using in lookup tables:
 * type Result = {
 *   true: 'yes'
 *   false: 'no'
 * }[BooleanCase<SomeCheck<T>>]
 * ```
 */
export type BooleanCase<$T extends boolean> = $T extends true ? 'true' : 'false'

/**
 * Intersection that ignores never and any.
 */
export type IntersectionIgnoreNeverOrAny<$T> =
  IsAny<$T> extends true ? unknown : $T extends never ? unknown : $T

/**
 * Convert never or any to unknown.
 */
export type NeverOrAnyToUnknown<$T> =
  IsAny<$T> extends true ? unknown : $T extends never ? unknown : $T

/**
 * Any narrowable primitive type.
 */
export type Narrowable = string | number | bigint | boolean | []

/**
 * Convert any and unknown to never.
 */
export type AnyAndUnknownToNever<$T> =
  IsAny<$T> extends true ? never : IsUnknown<$T> extends true ? never : $T

/**
 * Sentinel type for detecting whether an optional type parameter was provided.
 *
 * Use as default value for optional type parameters when you need to distinguish
 * between "user explicitly provided a type" vs "using default/inferring".
 *
 * Enables conditional behavior based on whether the caller provided an explicit type
 * argument or is relying on inference/defaults.
 *
 * @example
 * ```ts
 * // Different behavior based on whether type arg provided
 * function process<$T = SENTINEL>(...):
 *   SENTINEL.Is<$T> extends true
 *     ? // No type arg - infer from value
 *     : // Type arg provided - use it
 * ```
 *
 * @example
 * ```ts
 * // Real-world usage in assertion functions
 * type AssertFn<$Expected, $Actual = SENTINEL> =
 *   SENTINEL.Is<$Actual> extends true
 *     ? <$actual>(value: $actual) => void  // Value mode
 *     : void                                // Type-only mode
 * ```
 *
 * @category Type Utilities
 */
export type SENTINEL = { readonly __kit_ts_sentinel__: unique symbol }

/**
 * Utilities for working with the SENTINEL type.
 *
 * @category Type Utilities
 */
export namespace SENTINEL {
  /**
   * Check if a type is the SENTINEL (type parameter was omitted).
   *
   * Returns `true` if the type is `SENTINEL`, `false` otherwise.
   * Uses tuple wrapping to prevent distributive conditional behavior.
   *
   * @example
   * ```ts
   * type T1 = SENTINEL.Is<SENTINEL>  // true
   * type T2 = SENTINEL.Is<string>    // false
   * type T3 = SENTINEL.Is<never>     // false
   * ```
   *
   * @example
   * ```ts
   * // Using in conditional type logic
   * type Mode<$T> = SENTINEL.Is<$T> extends true ? 'infer' : 'explicit'
   * type M1 = Mode<SENTINEL>  // 'infer'
   * type M2 = Mode<string>    // 'explicit'
   * ```
   */
  export type Is<T> = [T] extends [SENTINEL] ? true : false

  /**
   * Sentinel type for representing an empty/unset value.
   *
   * Use this instead of `unknown` when you need a sentinel to indicate
   * "no value has been set" in contexts like optional configuration or state.
   *
   * @example
   * ```ts
   * // Using Empty as a sentinel for matcher state
   * interface Matcher {
   *   type: SENTINEL.Empty | string | number  // Empty means no matcher set
   * }
   * ```
   */
  export type Empty = { readonly __kit_ts_sentinel_empty__: unique symbol }

  /**
   * Check if a type is never or any.
   * These are real types, not sentinels.
   *
   * @example
   * ```ts
   * type T1 = SENTINEL.IsNeverOrAny<never>  // true
   * type T2 = SENTINEL.IsNeverOrAny<any>    // true
   * type T3 = SENTINEL.IsNeverOrAny<string> // false
   * ```
   */
  export type IsNeverOrAny<T> = [IsNever<T>] extends [true]
    ? true
    : [IsAny<T>] extends [true]
      ? true
      : false

  /**
   * Check if a type is the Empty sentinel.
   *
   * Returns `true` if the type is `SENTINEL.Empty`, `false` otherwise.
   * Returns `false` for never/any since they are real types, not sentinels.
   * Uses tuple wrapping to prevent distributive conditional behavior.
   *
   * @example
   * ```ts
   * type T1 = SENTINEL.IsEmpty<SENTINEL.Empty>  // true
   * type T2 = SENTINEL.IsEmpty<string>          // false
   * type T3 = SENTINEL.IsEmpty<unknown>         // false
   * type T4 = SENTINEL.IsEmpty<never>           // false (never is a real type)
   * type T5 = SENTINEL.IsEmpty<any>             // false (any is a real type)
   * ```
   */
  export type IsEmpty<T> = [IsNeverOrAny<T>] extends [true]
    ? false // never/any are NOT empty
    : [T] extends [Empty]
      ? true // Only Empty is empty
      : false

  /**
   * Convert SENTINEL.Is check to 'true' or 'false' string literal.
   * Shorthand for BooleanCase<SENTINEL.Is<T>>.
   *
   * @example
   * ```ts
   * type T1 = SENTINEL.CaseIs<SENTINEL.Empty>  // 'true'
   * type T2 = SENTINEL.CaseIs<string>          // 'false'
   *
   * // Using in lookup tables:
   * type Result = {
   *   true: 'sentinel'
   *   false: 'not-sentinel'
   * }[SENTINEL.CaseIs<T>]
   * ```
   */
  export type CaseIs<T> = BooleanCase<Is<T>>

  /**
   * Convert SENTINEL.IsEmpty check to 'true' or 'false' string literal.
   * Shorthand for BooleanCase<SENTINEL.IsEmpty<T>>.
   *
   * @example
   * ```ts
   * type T1 = SENTINEL.CaseIsEmpty<SENTINEL.Empty>  // 'true'
   * type T2 = SENTINEL.CaseIsEmpty<string>          // 'false'
   * type T3 = SENTINEL.CaseIsEmpty<never>           // 'false'
   *
   * // Using in lookup tables:
   * type Result = {
   *   true: 'empty'
   *   false: 'not-empty'
   * }[SENTINEL.CaseIsEmpty<T>]
   * ```
   */
  export type CaseIsEmpty<T> = BooleanCase<IsEmpty<T>>
}

// Export relation utilities
export * from './relation.js'

import type { Str } from '#str'
import type { Settings } from '#ts/ts'
import { type IsEmpty } from './diff.js'

// todo: Arr.Any/Unknown, Prom.Any/Unknown, etc. -- but this has no generics, we need a new term pattern here, e.g.: "Some", "Data", "Datum", "Item", "Element", "Value", "$", ... ?
export type Any = object

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Types
//
//
//
//

/**
 * Type for an empty object.
 *
 * @category Type Utilities
 */
export type Empty = Record<string, never>

/**
 * Frozen empty object singleton.
 * Use this instead of `{}` for better performance and immutability guarantees.
 *
 * @category Constants
 *
 * @example
 * ```ts
 * const opts = options ?? emptyObject
 * ```
 *
 * @example
 * ```ts
 * // Type is properly inferred
 * type T = typeof emptyObject  // {}
 * ```
 */
export const emptyObject = Object.freeze({})

/**
 * Type of the {@link emptyObject} constant.
 *
 * @category Type Utilities
 */
export type EmptyObject = typeof emptyObject

/**
 * Subtract properties present in $B from $A (shallow operation).
 *
 * Returns a new object type containing only properties that exist in $A but not in $B.
 * This is equivalent to `Omit<$A, keyof $B>` but expresses the operation as subtraction.
 *
 * @category Type Utilities
 *
 * @template $A - The object type to subtract from
 * @template $B - The object type whose properties to remove
 *
 * @example
 * ```ts
 * type User = { name: string; age: number; email: string }
 * type Public = { name: string; age: number }
 *
 * type Private = Obj.SubtractShallow<User, Public>  // { email: string }
 * type Same = Obj.SubtractShallow<User, User>        // {}
 * ```
 *
 * @example
 * ```ts
 * // Finding what's different between two object types
 * type Config = { id: string; debug?: boolean }
 * type Provided = { id: string; invalid: true; typo: string }
 *
 * type Extra = Obj.SubtractShallow<Provided, Config>  // { invalid: true; typo: string }
 * ```
 */
export type SubtractShallow<$A, $B> = Omit<$A, keyof $B>

/**
 * Create an empty object with proper type.
 * Returns a frozen empty object typed as {@link Empty}.
 *
 * @category Predicates
 *
 * @returns An empty object with type `Record<string, never>`
 *
 * @example
 * ```ts
 * const opts = options ?? Obj.empty()
 * ```
 *
 * @example
 * ```ts
 * // Type is properly inferred as Empty
 * const emptyObj = Obj.empty()
 * type T = typeof emptyObj  // Record<string, never>
 * ```
 */
export const empty = (): Empty => Object.freeze({}) as Empty

/**
 * Enforces that a type has no excess properties beyond those defined in the expected type.
 *
 * This utility recursively validates that the actual type contains no properties beyond those
 * in the expected type, checking nested objects as well. TypeScript will reject values with
 * excess properties at any depth. Particularly useful in generic contexts where excess property
 * checking is bypassed.
 *
 * @category Type Utilities
 *
 * @template $Value - The actual type to check for excess properties
 * @template $Constraint - The type defining allowed properties
 *
 * @example
 * ```ts
 * type User = { name: string; age: number }
 *
 * // Standard generic - allows excess properties
 * function test1<T extends User>(input: T): void {}
 * test1({ name: 'Alice', age: 30, extra: true })  // ✓ No error (excess allowed)
 *
 * // With NoExcess - rejects excess
 * function test2<T extends User>(input: Obj.NoExcess<T, User>): void {}
 * test2({ name: 'Alice', age: 30, extra: true })  // ✗ Error: 'extra' is never
 * test2({ name: 'Alice', age: 30 })  // ✓ OK
 * ```
 *
 * @example
 * ```ts
 * // Nested objects - validates recursively
 * type UserProfile = { profile: { name: string; age: number } }
 *
 * function setProfile<T extends UserProfile>(data: Obj.NoExcess<T, UserProfile>): void {}
 *
 * setProfile({ profile: { name: 'Alice', age: 30 } })  // ✓ OK
 * setProfile({ profile: { name: 'Alice', age: 30, extra: true } })  // ✗ Error: nested excess
 * ```
 *
 * @example
 * ```ts
 * // Using with optional properties
 * type Config = { id: string; debug?: boolean }
 *
 * function configure<T extends Config>(config: Obj.NoExcess<T, Config>): void {}
 *
 * configure({ id: 'test' })  // ✓ OK - optional omitted
 * configure({ id: 'test', debug: true })  // ✓ OK - optional included
 * configure({ id: 'test', invalid: 'x' })  // ✗ Error: 'invalid' is never
 * ```
 *
 * @example
 * ```ts
 * // Preserved types - built-in types are not recursed into
 * type Config = { timestamp: Date; count: number }
 *
 * function setConfig<T extends Config>(config: Obj.NoExcess<T, Config>): void {}
 *
 * setConfig({ timestamp: new Date(), count: 5 })  // ✓ OK - Date is preserved
 * setConfig({ timestamp: new Date(), count: 5, extra: true })  // ✗ Error: 'extra' is never
 * // Note: Date's internal properties are NOT validated (Date is preserved)
 * ```
 *
 * @remarks
 * This works by recursively mapping over the actual type's keys:
 * - Excess keys (not in Expected) are marked as `never`
 * - Valid keys recursively validate their nested values
 * - Preserved types (Date, Error, RegExp, etc.) are not recursed into
 *
 * Preserved types are registered via {@link KITZ.Ts.PreserveTypes} and include
 * built-in types (Date, Error, RegExp, Function) and branded primitives (Effect types, etc.).
 *
 * When a property is typed as `never`, TypeScript requires that it either:
 * - Not be present at all, OR
 * - Have a value that extends `never` (which is impossible for non-never types)
 *
 * This forces a type error when excess properties are provided at any depth.
 *
 * @see {@link NoExcessNonEmpty} for non-empty variant
 */
// dprint-ignore
export type NoExcess<$Value, $Constraint> =
  $Value extends Settings.GetPreservedTypes ? $Value :
  $Value extends object
    ? $Constraint extends object
      ? { [k in keyof $Value]:
          k extends keyof $Constraint
            ? NoExcess<$Value[k], $Constraint[k]>
            : never
        }
      : $Value
    : $Value

/**
 * Like {@link NoExcess} but also requires the object to be non-empty.
 *
 * Enforces that:
 * 1. Object has at least one property (not empty)
 * 2. Object has no excess properties beyond the constraint
 *
 * @category Type Utilities
 *
 * @example
 * ```ts
 * type User = { name: string }
 *
 * type T1 = NoExcessNonEmpty<{ name: 'Alice' }, User>        // ✓ Pass
 * type T2 = NoExcessNonEmpty<{}, User>                       // ✗ Fail - empty
 * type T3 = NoExcessNonEmpty<{ name: 'Bob', age: 30 }, User> // ✗ Fail - excess
 * ```
 */
export type NoExcessNonEmpty<$Value, $Constraint> = IsEmpty<$Value> extends true ? never
  : NoExcess<$Value, $Constraint>

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Runtime Functions
//
//
//
//

/**
 * Check if an object has no enumerable properties.
 *
 * @category Predicates
 *
 * @param obj - The object to check
 * @returns True if the object has no enumerable properties
 *
 * @example
 * ```ts
 * isEmpty({}) // true
 * isEmpty({ a: 1 }) // false
 * ```
 *
 * @example
 * ```ts
 * // Non-enumerable properties are ignored
 * const obj = {}
 * Object.defineProperty(obj, 'hidden', { value: 1, enumerable: false })
 * isEmpty(obj) // true - non-enumerable properties are ignored
 * ```
 */
export const isEmpty = (obj: object): boolean => {
  return Object.keys(obj).length === 0
}

/**
 * Type predicate that checks if an object has no enumerable properties.
 * Narrows the type to an empty object type.
 *
 * @category Predicates
 *
 * @param obj - The object to check
 * @returns True if the object has no enumerable properties, with type narrowing to Empty
 *
 * @example
 * ```ts
 * const obj: { a?: number } = {}
 * if (isEmpty$(obj)) {
 *   // obj is now typed as Empty
 * }
 * ```
 *
 * @example
 * ```ts
 * // Useful in conditional type flows
 * function processObject<T extends object>(obj: T) {
 *   if (isEmpty$(obj)) {
 *     // obj is Empty here
 *     return 'empty'
 *   }
 *   // obj retains its original type here
 * }
 * ```
 */
export const isEmpty$ = <$T extends object>(obj: $T): obj is $T & Empty => {
  return Object.keys(obj).length === 0
}

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Key Formatting Utilities
//
//
//
//

/**
 * Align object keys by padding with a character to a target length.
 *
 * Pads string keys to the specified length using the given fill character.
 * Non-string keys (symbols, numbers) are left unchanged.
 * Ensures consistent alignment of object keys in IDE displays.
 *
 * @category Type Utilities
 *
 * @template $T - The type whose keys should be aligned
 * @template $Length - The target length for padded keys
 * @template $Pad - The character to use for padding (defaults to '_')
 *
 * @example
 * ```ts
 * type Input = { MESSAGE: string, EXPECTED: number }
 * type Output = Obj.AlignKeys<Input, 12>
 * // { MESSAGE_____: string, EXPECTED____: number }
 *
 * // Custom padding character
 * type Output2 = Obj.AlignKeys<Input, 12, '.'>
 * // { MESSAGE.....: string, EXPECTED....: number }
 * ```
 */
export type AlignKeys<$T, $Length extends number, $Pad extends string = '_'> = {
  [k in keyof $T as k extends string ? Str.PadEnd<k, $Length, $Pad> : k]: $T[k]
}

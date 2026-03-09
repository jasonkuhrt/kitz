import type { Simplify } from './__.js'
import type { StaticError } from './err.js'
import type { Show, ShowInTemplate } from './ts.js'

/**
 * Create a type guard that checks if a value equals a reference value.
 *
 * @param reference - The reference value to compare against
 * @returns A type guard function that narrows to the reference type
 *
 * @example
 * ```ts
 * const isNull = isTypeWith(null)
 * const value: string | null = getString()
 * if (isNull(value)) {
 *   // value is narrowed to null
 * }
 * ```
 */
export const isTypeWith = <reference>(reference: reference) => {
  return <valueGiven>(
    value: ValidateIsSupertype<reference, valueGiven>,
  ): value is reference extends valueGiven ? reference : never => {
    return value === (reference as any)
  }
}

/**
 * Create a type guard that checks if a value does not equal a reference value.
 *
 * @param reference - The reference value to compare against
 * @returns A type guard function that narrows by excluding the reference type
 *
 * @example
 * ```ts
 * const isntNull = isntTypeWith(null)
 * const value: string | null = getString()
 * if (isntNull(value)) {
 *   // value is narrowed to string
 * }
 * ```
 */
export const isntTypeWith = <reference>(reference: reference) => {
  return <valueGiven>(
    value: ValidateIsSupertype<reference, valueGiven>,
  ): value is reference extends valueGiven ? Exclude<valueGiven, reference> : never => {
    return value !== (reference as any)
  }
}

type ValidateIsSupertype<$Reference, $Value> =
  // oxfmt-ignore
  $Reference extends $Value
    ? $Value
    : Simplify.Top<StaticErrorGuardNotSubtype<$Reference, $Value>>

interface StaticErrorGuardNotSubtype<$Reference, $Value>
  // oxfmt-ignore
  extends StaticError<
    ['type-guard', 'not-subtype'],
    {
      message: `This type guard for ${ShowInTemplate<$Reference>} cannot be used against the given value ${ShowInTemplate<$Value>} because it is not a supertype.`
      guard: $Reference
      value: $Value
      tip: `Since your value type has no overlap with ${Show<$Reference>} this will always return false.`
    }
  > {}

/**
 * Extract the guarded type from a type guard function.
 *
 * Useful for getting the narrowed type from type guard predicates without
 * having to manually extract it from the function signature.
 *
 * @template $T - A type guard function type
 * @returns The type that the guard narrows to, or `never` if not a type guard
 *
 * @example
 * ```ts
 * function isString(value: unknown): value is string {
 *   return typeof value === 'string'
 * }
 *
 * type StringType = GuardedType<typeof isString>  // string
 * ```
 *
 * @example
 * ```ts
 * // With generic type guards
 * function isArray<T>(value: unknown): value is T[] {
 *   return Array.isArray(value)
 * }
 *
 * type ArrayType = GuardedType<typeof isArray>  // unknown[]
 * ```
 *
 * @example
 * ```ts
 * // Non-guard functions return never
 * function notAGuard(x: any): boolean {
 *   return true
 * }
 *
 * type NoGuard = GuardedType<typeof notAGuard>  // never
 * ```
 *
 * @category Type Utilities
 */
export type GuardedType<$T> = $T extends ((x: any) => x is infer __u__) ? __u__ : never

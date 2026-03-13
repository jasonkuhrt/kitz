import { Fn } from '#fn'

/**
 * Negate a boolean value.
 *
 * @param value - The boolean value to negate.
 * @returns The negated boolean value.
 *
 * @example
 * ```ts
 * Bool.not(true) // false
 * Bool.not(false) // true
 * ```
 */
export const not = <value extends boolean>(value: value): not<value> => {
  return !value as any
}

/**
 * Type-level boolean negation.
 * Maps true to false and false to true at the type level.
 */
export type not<value extends boolean> = value extends true ? false : true

/**
 * Create a negated version of a predicate function.
 *
 * @param predicate - The predicate function to negate.
 * @returns A new predicate that returns the opposite boolean value.
 *
 * @example
 * ```ts
 * const isEven = (n: number) => n % 2 === 0
 * const isOdd = Bool.negate(isEven)
 *
 * isEven(4) // true
 * isOdd(4) // false
 *
 * isEven(3) // false
 * isOdd(3) // true
 * ```
 */
export const negate = <predicate extends Predicate>(predicate: predicate): predicate => {
  const negated = (value: any) => {
    return !predicate(value)
  }
  return negated as any
}

// Predicate

/**
 * A function that tests a value and returns a boolean.
 *
 * @template $Value - The type of value the predicate accepts.
 */
export type Predicate<$Value = unknown> = (value: $Value) => boolean

/**
 * A TypeScript type predicate that narrows the type of a value.
 *
 * @template $Type - The type to narrow to.
 */
export type TypePredicate<$Type> = (value: unknown) => value is $Type

/**
 * A value that is either a predicate function or a constant value.
 *
 * @template $Value - The type of value.
 */
export type PredicateMaybe<$Value> = $Value | Predicate<$Value>

/**
 * Convert a value or predicate into a predicate function.
 * If the input is already a function, it is returned as-is.
 * If the input is a value, a predicate that always returns that value is created.
 *
 * @param predicateMaybe - Result a predicate function or a constant value.
 * @returns A predicate function.
 *
 * @example
 * ```ts
 * // with a predicate function
 * const isPositive = (n: number) => n > 0
 * const pred1 = Bool.ensurePredicate(isPositive)
 * pred1(5) // true
 * pred1(-3) // false
 *
 * // with a constant value
 * const pred2 = Bool.ensurePredicate(true)
 * pred2(42) // true
 *
 * const pred3 = Bool.ensurePredicate(false)
 * pred3('hello') // false
 * ```
 */
export const ensurePredicate = <predicateMaybe extends PredicateMaybe<any>>(
  predicateMaybe: predicateMaybe,
): ensurePredicate<predicateMaybe> => {
  const predicate = Fn.is(predicateMaybe) ? predicateMaybe : Fn.constant(predicateMaybe)
  return predicate as any
}

/**
 * Type-level function that ensures a PredicateMaybe is converted to a Predicate.
 * If the input is already a Predicate, it returns the same type.
 * If the input is a value, it returns a Predicate that returns that value type.
 */
// oxfmt-ignore
export type ensurePredicate<$PredicateMaybe extends PredicateMaybe<any>> =
  $PredicateMaybe extends Predicate
    ? $PredicateMaybe
    : Predicate<$PredicateMaybe>

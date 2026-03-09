import { Lang } from '#lang'
import { Ts } from '#ts'
/**
 * Check if two values are the same reference using the === operator.
 *
 * This function only works with reference types (objects, arrays, functions).
 * For primitive values, use the appropriate domain's Eq trait instead.
 *
 * @param a - First reference to compare
 * @param b - Second reference to compare
 * @returns `true` if values are the same reference, `false` otherwise
 *
 * @example
 * ```ts
 * // Objects
 * const obj1 = { a: 1 }
 * const obj2 = { a: 1 }
 * Ref.is(obj1, obj1) // true (same reference)
 * Ref.is(obj1, obj2) // false (different references)
 *
 * // Arrays
 * const arr1 = [1, 2, 3]
 * const arr2 = [1, 2, 3]
 * Ref.is(arr1, arr1) // true (same reference)
 * Ref.is(arr1, arr2) // false (different references)
 *
 * // Functions
 * const fn1 = () => {}
 * const fn2 = () => {}
 * Ref.is(fn1, fn1) // true
 * Ref.is(fn1, fn2) // false
 * ```
 */
export const is = <A, B>(a: ValidateIsReference<A>, b: ValidateIsComparable<A, B>): boolean => {
  return a === b
}

/**
 * Curried version of `is` that creates a predicate function.
 *
 * @param a - Value to compare against
 * @returns Function that checks if its argument is the same reference as `a`
 *
 * @example
 * ```ts
 * const obj = { id: 1 }
 * const isSameObj = Ref.isOn(obj)
 *
 * isSameObj(obj) // true
 * isSameObj({ id: 1 }) // false (different instance)
 *
 * // Useful for filtering
 * const items = [obj, { id: 2 }, obj, { id: 3 }]
 * items.filter(Ref.isOn(obj)) // [obj, obj]
 * ```
 */
export const isOn =
  <A>(a: ValidateIsReference<A>) =>
  <B>(b: ValidateIsComparable<A, B>): boolean => {
    return a === b
  }

/**
 * Check if two values are different references using the !== operator.
 *
 * This is the inverse of `is`. Returns `true` if the values are not the same
 * reference.
 *
 * @param a - First value to compare
 * @param b - Second value to compare
 * @returns `true` if values are different references, `false` if same
 *
 * @example
 * ```ts
 * Ref.isnt([1, 2], [1, 2]) // true (different arrays)
 * Ref.isnt('hello', 'world') // true (different values)
 *
 * const obj = { a: 1 }
 * Ref.isnt(obj, obj) // false (same reference)
 * ```
 */
export const isnt = <A, B>(a: ValidateIsReference<A>, b: ValidateIsComparable<A, B>): boolean => {
  return a !== b
}

/**
 * Curried version of `isnt` that creates a predicate function.
 *
 * @param a - Value to compare against
 * @returns Function that checks if its argument is a different reference from `a`
 *
 * @example
 * ```ts
 * const target = { id: 1 }
 * const isNotTarget = Ref.isntOn(target)
 *
 * isNotTarget({ id: 1 }) // true (different instance)
 * isNotTarget(target) // false (same instance)
 *
 * // Useful for filtering out specific instances
 * const items = [target, { id: 2 }, target]
 * items.filter(Ref.isntOn(target)) // [{ id: 2 }]
 * ```
 */
export const isntOn =
  <A>(a: ValidateIsReference<A>) =>
  <B>(b: ValidateIsComparable<A, B>): boolean => {
    return a !== b
  }

/**
 * Check if a value can have different references for the same logical value.
 *
 * Returns `true` for objects, arrays, functions, and other reference types.
 * Returns `false` for primitives (string, number, boolean, null, undefined, symbol, bigint).
 *
 * This is useful for understanding when reference equality differs from value equality.
 *
 * @param value - Value to check
 * @returns `true` if the value is a reference type, `false` if primitive
 *
 * @example
 * ```ts
 * // Reference types
 * Ref.canDiffer({}) // true
 * Ref.canDiffer([]) // true
 * Ref.canDiffer(() => {}) // true
 * Ref.canDiffer(new Date()) // true
 *
 * // Primitives
 * Ref.canDiffer('hello') // false
 * Ref.canDiffer(42) // false
 * Ref.canDiffer(true) // false
 * Ref.canDiffer(null) // false
 * Ref.canDiffer(undefined) // false
 * Ref.canDiffer(Symbol()) // false
 * Ref.canDiffer(42n) // false
 * ```
 */
export const isReferenceEquality = (value: Lang.Value): value is object => {
  return (typeof value === 'object' && value !== null) || typeof value === 'function'
}

/**
 * Check if a value is immutable (cannot have different references).
 *
 * This is the inverse of `canDiffer`. Returns `true` for primitive values
 * where reference equality is the same as value equality.
 *
 * @param value - Value to check
 * @returns `true` if the value is primitive/immutable, `false` if reference type
 *
 * @example
 * ```ts
 * Ref.isImmutable('hello') // true
 * Ref.isImmutable(42) // true
 * Ref.isImmutable(null) // true
 *
 * Ref.isImmutable({}) // false
 * Ref.isImmutable([]) // false
 * ```
 */
export const isValueEquality = (value: Lang.Value): value is Lang.Primitive => {
  return !isReferenceEquality(value)
}

// Type validation helpers

/**
 * Error type for when primitive types are used with Ref operations.
 */
export interface ErrorPrimitiveType<T> extends Ts.Err.StaticError<
  ['ref', 'primitive-type'],
  {
    message: `Ref operations only work with reference types.`
    ProvidedType: T
    tip: `Use domain Eq traits for primitives (e.g., Str.Eq.is, Num.Eq.is).`
  }
> {}

/**
 * Error type for comparing identical primitive literals.
 */
export interface ErrorNotComparableSamePrimitive<T> extends Ts.Err.StaticError<
  ['ref', 'not-comparable-same-primitive'],
  {
    message: `Comparing ${Ts.ShowInTemplate<T>} to itself is meaningless.`
    Type: T
    tip: `This comparison would always return true.`
  }
> {}

/**
 * Error type for comparing types with no overlap.
 */
export interface ErrorNotComparableOverlap<A, B> extends Ts.Err.StaticError<
  ['ref', 'not-comparable-overlap'],
  {
    message: `Cannot compare structurally different types ${Ts.ShowInTemplate<A>} and ${Ts.ShowInTemplate<B>}.`
    TypeA: A
    TypeB: B
    tip: `While rare, different types can refer to the same instance if an object has properties from both types. Use @ts-expect-error if this is intentional.`
  }
> {}

/**
 * Validate that a type is a reference type (not a primitive).
 */
// oxfmt-ignore
type ValidateIsReference<T> = T extends Lang.Primitive ?
  ErrorPrimitiveType<T>
  : T

// oxfmt-ignore
type ValidateIsComparable<A, B> =
    Ts.Relation.GetRelation<A, B> extends Ts.Relation.subtype | Ts.Relation.supertype | Ts.Relation.overlapping ? B
  : Ts.Relation.GetRelation<A, B> extends Ts.Relation.equivalent ?
        A extends Lang.Primitive ? ErrorNotComparableSamePrimitive<A>
      : B  // Allow equivalent comparison for non-primitives
  : Ts.Relation.GetRelation<A, B> extends Ts.Relation.disjoint ? ErrorNotComparableOverlap<A, B>
  : never

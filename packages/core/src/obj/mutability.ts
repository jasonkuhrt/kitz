import type { Bool } from '#bool'
import { Lang } from '#lang'
import type { Ts } from '#ts'

/**
 * Static error for invalid forwardImmutability usage: mutable input with immutable output.
 *
 * @category Immutability
 */
export interface ErrorMutableInputImmutableOutput extends Ts.Err.StaticError<
  ['forwardImmutability'],
  {
    message: 'Mutable input with immutable output is likely a bug - the caller expects a mutable result but provided a frozen output'
  }
> {}

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Immutability Utilities
//
//
//
//

/**
 * Create a frozen shallow copy of an object with a readonly type.
 * Provides both runtime immutability (via Object.freeze) and type-level readonly.
 *
 * This creates a new object - the original is not modified.
 * Use {@link toImmutableMut} if you want to freeze in place.
 *
 * @category Immutability
 *
 * @param obj - The object to copy and freeze
 * @returns A new frozen object with readonly type
 *
 * @example
 * ```ts
 * const original = { port: 3000, host: 'localhost' }
 * const config = Obj.toImmutable(original)
 * // config is frozen, original is not
 * // Type: Readonly<{ port: number; host: string }>
 *
 * config.port = 8080 // TypeScript error: Cannot assign to 'port' because it is read-only
 * ```
 */
export const toImmutable = <$obj extends object>(obj: $obj): toImmutable<$obj> => {
  if (Object.isFrozen(obj)) return obj as toImmutable<$obj>
  const copy = (Array.isArray(obj) ? [...obj] : { ...obj }) as $obj
  return toImmutableMut(copy)
}

/**
 * Freeze an object in place and return it with a readonly type.
 * Mutates the original object.
 *
 * Use {@link toImmutable} for the safer copy-then-freeze behavior.
 *
 * @category Immutability
 *
 * @param obj - The object to freeze in place
 * @returns The same object, now frozen, with readonly type
 *
 * @example
 * ```ts
 * const config = { port: 3000 }
 * const frozen = Obj.toImmutableMut(config)
 * // frozen === config (same reference)
 * // Both are now frozen
 * ```
 */
export const toImmutableMut = <$obj extends object>(obj: $obj): toImmutable<$obj> => {
  return Object.freeze(obj)
}

export type toImmutable<$Obj extends object> = Readonly<$Obj>

/**
 * Create a shallow clone of an object, preserving its immutability state.
 * If the input is frozen, the clone is frozen. If mutable, the clone is mutable.
 *
 * @category Clone
 *
 * @param obj - The object to clone
 * @returns A new object with the same immutability state as the input
 *
 * @example
 * ```ts
 * const frozen = Object.freeze({ a: 1 })
 * const frozenClone = Obj.clone(frozen)
 * // frozenClone is frozen, same type as input
 *
 * const mutable = { a: 1 }
 * const mutableClone = Obj.clone(mutable)
 * // mutableClone is NOT frozen
 * ```
 */
export const clone = <$obj extends object>(obj: $obj): $obj => {
  const copy = (Array.isArray(obj) ? [...obj] : { ...obj }) as $obj
  return Object.isFrozen(obj) ? (Object.freeze(copy) as $obj) : copy
}

/**
 * Create an unfrozen shallow clone of an object with a mutable type.
 * Always returns a mutable clone, regardless of input's frozen state.
 *
 * @category Clone
 *
 * @param obj - The object to clone (typically frozen)
 * @returns A new unfrozen object with mutable type
 *
 * @example
 * ```ts
 * const frozen = Object.freeze({ port: 3000, host: 'localhost' })
 * const mutable = Obj.cloneToMut(frozen)
 * // mutable is NOT frozen, frozen is still frozen
 * // Type: { port: number; host: string }
 *
 * mutable.port = 8080 // OK
 * ```
 */
export const cloneToMut = <$obj extends object>(obj: $obj): cloneToMut<$obj> => {
  return (Array.isArray(obj) ? [...obj] : { ...obj }) as cloneToMut<$obj>
}

export type cloneToMut<$Obj extends object> = { -readonly [K in keyof $Obj]: $Obj[K] }

/**
 * Type guard that checks if an object is frozen (immutable).
 * Narrows the type to `Readonly<T>` when true.
 *
 * @category Immutability
 *
 * @param obj - The object to check
 * @returns True if the object is frozen, with type narrowing to Readonly
 *
 * @example
 * ```ts
 * const config = { port: 3000 }
 *
 * if (Obj.isImmutable(config)) {
 *   // config is Readonly<{ port: number }> here
 *   config.port = 8080 // TypeScript error
 * }
 * ```
 */
export const isImmutable = <$obj extends object>(obj: $obj): obj is toImmutable<$obj> => {
  return Object.isFrozen(obj)
}

/**
 * Type-level check if an object type is immutable (all properties readonly).
 *
 * @category Immutability
 *
 * @example
 * ```ts
 * type T1 = Obj.isImmutable<{ readonly a: 1 }> // true
 * type T2 = Obj.isImmutable<{ a: 1 }> // false
 * ```
 */
export type isImmutable<$obj extends object> = Ts.Relation.IsExact<$obj, toImmutable<$obj>>

/**
 * Type-level check if an object type is mutable (has any non-readonly properties).
 *
 * @category Immutability
 *
 * @example
 * ```ts
 * type T1 = Obj.isMutable<{ a: 1 }> // true
 * type T2 = Obj.isMutable<{ readonly a: 1 }> // false
 * ```
 */
export type isMutable<$obj extends object> = Bool.not<isImmutable<$obj>>

/**
 * Infer the immutability mode from multiple inputs.
 * Returns 'immutable' if ANY input is frozen, 'mutable' only if ALL are mutable.
 *
 * @category Immutability
 *
 * @param inputs - The objects to check
 * @returns 'immutable' if any input is frozen, 'mutable' otherwise
 *
 * @example
 * ```ts
 * const frozen = Object.freeze({ a: 1 })
 * const mutable = { b: 2 }
 *
 * Obj.inferImmutabilityMode(frozen, mutable) // 'immutable'
 * Obj.inferImmutabilityMode(mutable, mutable) // 'mutable'
 * ```
 */
export const inferImmutabilityMode = (...inputs: object[]): 'immutable' | 'mutable' => {
  return inputs.some(isImmutable) ? 'immutable' : 'mutable'
}

// oxfmt-ignore
type GuardForwardImmutabilityOutput<$input extends object, $output extends object> =
  isImmutable<$input> extends true ? $output :
  isMutable<$output> extends true  ? $output :
                                     Ts.Err.Render<ErrorMutableInputImmutableOutput>

/**
 * Forward the frozen/mutable state from an input to an output.
 * If input is frozen, freezes output. Otherwise returns output as-is.
 *
 * Useful for operations that create new structures but want to preserve
 * the mutability characteristics of their inputs (polymorphic dispatch).
 *
 * @category Immutability
 *
 * @param input - The input to check frozen state on
 * @param output - The output to conditionally freeze. Must be mutable if input is mutable.
 * @returns The output, frozen if input was frozen
 * @throws {Error} If input is mutable but output is frozen (likely a bug)
 *
 * @example
 * ```ts
 * const frozenArr = Object.freeze([1, 2, 3])
 * const result = Obj.forwardImmutability(frozenArr, [4, 5, 6])
 * // result is frozen because frozenArr was frozen
 *
 * const mutableArr = [1, 2, 3]
 * const result2 = Obj.forwardImmutability(mutableArr, [4, 5, 6])
 * // result2 is NOT frozen because mutableArr was not frozen
 * ```
 */
export const forwardImmutability = <$input extends object, $output extends object>(
  input: $input,
  output: GuardForwardImmutabilityOutput<$input, $output>,
): $input => {
  if (!Object.isFrozen(input) && Object.isFrozen(output)) {
    Lang.panic('forwardImmutability: mutable input with immutable output is likely a bug')
  }
  return (Object.isFrozen(input) ? toImmutableMut(output as object) : output) as $input
}

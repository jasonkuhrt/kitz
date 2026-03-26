import { CoreLang } from '#lang/core'
import type {
  Primitive,
  TypeGuardImplementation,
  TypeGuardImplementationInput,
} from '#lang/core/lang'
import type { Prom } from '#prom'
import * as fc from 'fast-check'

// Re-export types from core namespace
export type {
  Primitive,
  TypeGuard,
  TypeGuardImplementation,
  TypeGuardImplementationInput,
  TypeofTypes,
} from '#lang/core/lang'

// Re-export values from core namespace
export const { typeGuard, TypeofTypesEnum } = CoreLang

/**
 * A type guard that excludes a specific type.
 */
export type NegatedTypeGuard<$Type> = (value: unknown) => value is Exclude<typeof value, $Type>

/**
 * Create a negated type guard that excludes a specific type.
 *
 * @param typeGuard - The guard function to negate.
 * @returns A negated type guard function.
 *
 * @example
 * ```ts
 * const isNotString = negatedTypeGuard<string>(value => typeof value === 'string')
 * ```
 */
export const negatedTypeGuard = <type>(
  typeGuard: TypeGuardImplementationInput,
): NegatedTypeGuard<type> => {
  if (typeof typeGuard === TypeofTypesEnum.function) {
    const guard = typeGuard as TypeGuardImplementation
    return ((value: unknown): value is Exclude<typeof value, type> => !guard(value)) as any
  }

  return (value): value is Exclude<typeof value, type> => value !== typeGuard
}

// Async

/**
 * Alias for Promise type.
 */
export type Async<$Value> = Promise<$Value>

/**
 * An async operation that performs side effects without returning a value.
 */
export type SideEffectAsync = Promise<void>

/**
 * A synchronous operation that performs side effects without returning a value.
 */
export type SideEffect = void

/**
 * An operation that may be synchronous or asynchronous, performing side effects without returning a value.
 */
export type SideEffectAsyncMaybe = Prom.Maybe<void>

// Workflow

// Value

/**
 * Any JavaScript value (primitive or object).
 */
export type Value = Primitive | object

/**
 * Check if a value is a JavaScript primitive.
 *
 * @param value - The value to check.
 * @returns True if the value is a primitive.
 *
 * @example
 * ```ts
 * isPrimitive('hello') // true
 * isPrimitive({}) // false
 * isPrimitive(null) // true
 * ```
 */
export const isPrimitive = (value: unknown): value is Primitive => {
  const type = typeof value
  // todo: use Obj.is
  return (type !== TypeofTypesEnum.object || value === null) && type !== TypeofTypesEnum.function
}

/**
 * Check if a value is a symbol.
 *
 * @param value - The value to check.
 * @returns True if the value is a symbol.
 *
 * @example
 * ```ts
 * isSymbol(Symbol('test')) // true
 * isSymbol('hello') // false
 * isSymbol(42) // false
 * ```
 */
export const isSymbol = (value: unknown): value is symbol => {
  return typeof value === TypeofTypesEnum.symbol
}

/**
 * Extract the narrowed type from a type guard function.
 *
 * @example
 * ```ts
 * type Guard = (x: unknown) => x is string
 * type Narrowed = ExtractPredicateType<Guard> // string
 * ```
 */
export type ExtractPredicateType<T> = T extends ((x: any) => x is infer U) ? U : never

// Testing utilities

/**
 * Fast-check arbitrary for generating Language.Value types.
 *
 * Generates all possible primitive types and object types that
 * make up the Language.Value union.
 *
 * @example
 * ```ts
 * import * as fc from 'fast-check'
 * import { Language } from '#language'
 *
 * fc.assert(fc.property(Language.ValueArb, (value) => {
 *   // value is Language.Value (Primitive | object)
 *   const isPrim = Language.isPrimitive(value)
 *   return typeof isPrim === 'boolean'
 * }))
 * ```
 */
export const ValueArb = fc.oneof(
  // Primitives
  fc.string(),
  fc.integer(),
  fc.bigInt(),
  fc.boolean(),
  fc.constant(null),
  fc.constant(undefined),
  // For symbols, just create simple ones
  fc.constant(Symbol('test')),
  // Reference types - keep them simple to avoid hanging tests
  fc.object({ maxDepth: 2 }), // Shallow objects
  fc.func(fc.constant(42)), // Simple functions that return constants
  fc.array(fc.oneof(fc.string(), fc.integer()), { maxLength: 10 }), // Small arrays of primitives
)

/**
 * Fast-check arbitrary for generating reference types only.
 * Useful for testing reference equality operations.
 */
export const ReferenceArb = fc.oneof(
  fc.object({ maxDepth: 2 }),
  fc.array(fc.oneof(fc.string(), fc.integer()), { maxLength: 10 }),
  fc.func(fc.constant(42)),
  fc.date(),
  // fc.set(fc.integer(), { maxLength: 5 }), // set is not available in fast-check
  fc.dictionary(fc.string(), fc.integer(), { maxKeys: 5 }),
)

/**
 * Fast-check arbitrary for generating primitive types only.
 */
export const PrimitiveArb = fc.oneof(
  fc.string(),
  fc.integer(),
  fc.bigInt(),
  fc.boolean(),
  fc.constant(null),
  fc.constant(undefined),
  fc.constant(Symbol('test')),
)

/**
 * Built-in types that should not be expanded in error messages.
 * @internal
 */
export type BuiltInTypes =
  | string
  | number
  | boolean
  | symbol
  | bigint
  | null
  | undefined
  | void
  | Array<any>
  | ReadonlyArray<any>
  | Promise<any>
  | Map<any, any>
  | Set<any>
  | WeakMap<any, any>
  | WeakSet<any>
  | Date
  | RegExp
  | Error
  | Function
  | ((...args: any[]) => any)

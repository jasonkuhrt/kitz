import { Lang } from '#lang'
import type { Writable } from 'type-fest'
import { type IsEmpty } from './diff.js'
import { entries } from './get.js'
import { is as isObj } from './is.js'
import { type Any } from './type.js'

/**
 * Assert that a value is an object.
 * Throws a TypeError if the value is not an object (including null).
 *
 * @category Shape & Validation
 *
 * @param value - The value to check
 * @throws {TypeError} If the value is not an object
 *
 * @example
 * ```ts
 * function process(value: unknown) {
 *   Obj.assert(value)
 *   // value is now typed as object
 *   console.log(Object.keys(value))
 * }
 * ```
 */
export function assert(value: unknown): asserts value is object {
  if (typeof value !== 'object' || value === null) {
    Lang.throw(new TypeError(`Expected object but got ${typeof value}`))
  }
}

// Note: entries moved to get.ts

// Note: keyofOr moved to get.ts

/**
 * Create a type predicate function that checks if a value matches a shape specification.
 * Uses JavaScript's `typeof` operator to validate property types.
 *
 * @category Shape & Validation
 *
 * @param spec - An object mapping property names to their expected typeof results
 * @returns A type predicate function that checks if a value matches the shape
 *
 * @example
 * ```ts
 * const isUser = isShape<{ name: string; age: number }>({
 *   name: 'string',
 *   age: 'number'
 * })
 *
 * isUser({ name: 'Alice', age: 30 }) // true
 * isUser({ name: 'Bob' }) // false - missing age
 * isUser({ name: 'Charlie', age: '30' }) // false - age is string
 * ```
 *
 * @example
 * ```ts
 * // Can check for functions and other typeof types
 * const isCallback = isShape<{ fn: Function }>({
 *   fn: 'function'
 * })
 * ```
 */
export const isShape = <type>(spec: Record<PropertyKey, Lang.TypeofTypes>) => (value: unknown): value is type => {
  if (!isObj(value)) return false
  const obj_ = value as Record<PropertyKey, unknown>

  return entries(spec).every(([key, typeofType]) => {
    return typeof obj_[key] === typeofType
  })
}

// Note: IsEmpty, Empty, empty, isEmpty, isEmpty$ moved to type.ts

const PrivateStateSymbol = Symbol('PrivateState')

/**
 * Attach private state to an object using a non-enumerable Symbol property.
 * The state is immutable once set and cannot be discovered through enumeration.
 *
 * @category State Management
 *
 * @param obj - The object to attach private state to
 * @param value - The state object to attach
 * @returns The original object with private state attached
 *
 * @example
 * ```ts
 * const user = { name: 'Alice' }
 * const privateData = { password: 'secret123' }
 *
 * setPrivateState(user, privateData)
 * // user still appears as { name: 'Alice' } when logged
 * // but has hidden private state accessible via getPrivateState
 * ```
 *
 * @example
 * ```ts
 * // Useful for attaching metadata without polluting the object
 * const config = { timeout: 5000 }
 * setPrivateState(config, {
 *   source: 'environment',
 *   timestamp: Date.now()
 * })
 * ```
 */
export const setPrivateState = <obj extends Any>(obj: obj, value: object): obj => {
  Object.defineProperty(obj, PrivateStateSymbol, {
    value,
    writable: false,
    enumerable: false,
    configurable: false,
  })
  return obj
}

/**
 * Retrieve private state previously attached to an object with setPrivateState.
 *
 * @category State Management
 *
 * @param obj - The object to retrieve private state from
 * @returns The private state object
 * @throws Error if no private state is found on the object
 *
 * @example
 * ```ts
 * const user = { name: 'Alice' }
 * setPrivateState(user, { role: 'admin' })
 *
 * const privateData = getPrivateState<{ role: string }>(user)
 * console.log(privateData.role) // 'admin'
 * ```
 *
 * @example
 * ```ts
 * // Type-safe private state retrieval
 * interface Metadata {
 *   createdAt: number
 *   createdBy: string
 * }
 *
 * const doc = { title: 'Report' }
 * setPrivateState(doc, { createdAt: Date.now(), createdBy: 'system' })
 *
 * const meta = getPrivateState<Metadata>(doc)
 * // meta is typed as Metadata
 * ```
 */
export const getPrivateState = <state extends Any>(obj: Any): state => {
  const descriptor = Object.getOwnPropertyDescriptor(obj, PrivateStateSymbol)
  if (!descriptor) throw new Error('Private state not found')
  return descriptor.value
}

/**
 * Check if an object has any non-undefined values.
 *
 * @category Predicates
 *
 * @param object - The object to check
 * @returns True if at least one value is not undefined
 * @example
 * ```ts
 * hasNonUndefinedKeys({ a: undefined, b: undefined })  // false
 * hasNonUndefinedKeys({ a: undefined, b: 1 })  // true
 * hasNonUndefinedKeys({})  // false
 * ```
 */
export const hasNonUndefinedKeys = (object: object): boolean => {
  return Object.values(object).some(value => value !== undefined)
}

/**
 * Check if a value has a symbol property with a specific value, using fuzzy matching.
 *
 * This utility handles cases where symbols might be different instances due to module loading
 * issues (e.g., when using vitest or other tools that may load the same module multiple times).
 * It first attempts a direct symbol lookup (fast path), then falls back to matching by symbol
 * description if the direct lookup fails.
 *
 * @category Predicates
 *
 * @param value - The value to check (must be an object)
 * @param symbol - The symbol to look for
 * @param expectedValue - The expected value of the symbol property
 * @returns True if the value has the symbol property with the expected value
 *
 * @example
 * ```ts
 * const Transport = Symbol('Transport')
 * const http = { [Transport]: 'http' }
 *
 * Obj.hasSymbolLike(http, Transport, 'http')  // true
 * Obj.hasSymbolLike(http, Transport, 'https') // false
 * Obj.hasSymbolLike({}, Transport, 'http')    // false
 * ```
 *
 * @example
 * ```ts
 * // Handles symbol instance mismatches in test environments
 * // where the same module might be loaded multiple times
 * const sym1 = Symbol('id')
 * const sym2 = Symbol('id') // Different instance, same description
 * const obj = { [sym1]: 'value' }
 *
 * Obj.hasSymbolLike(obj, sym2, 'value') // true (via fallback)
 * ```
 */
export const hasSymbolLike = (value: unknown, symbol: symbol, expectedValue: unknown): boolean => {
  if (!isObj(value)) {
    return false
  }

  // Fast path: direct symbol check
  if ((value as any)[symbol] === expectedValue) {
    return true
  }

  // Fallback: check for any symbol with matching description and value
  // This handles cases where the symbol might be different instances due to module loading
  const symbols = Object.getOwnPropertySymbols(value)
  const expectedSymbolString = symbol.toString()

  for (const sym of symbols) {
    if (sym.toString() === expectedSymbolString && (value as any)[sym] === expectedValue) {
      return true
    }
  }

  return false
}

/**
 * Curried version of {@link hasSymbolLike}.
 * Returns a predicate function that checks if a value has a symbol property with a specific value.
 *
 * @category Predicates
 *
 * @param symbol - The symbol to look for
 * @param expectedValue - The expected value of the symbol property
 * @returns A predicate function that checks for the symbol property
 *
 * @example
 * ```ts
 * const Transport = Symbol('Transport')
 * const isHttpTransport = Obj.hasSymbolLikeWith(Transport, 'http')
 *
 * isHttpTransport({ [Transport]: 'http' })  // true
 * isHttpTransport({ [Transport]: 'https' }) // false
 * isHttpTransport({})                       // false
 * ```
 *
 * @example
 * ```ts
 * // Useful for filtering
 * const Kind = Symbol('Kind')
 * const objects = [
 *   { [Kind]: 'user' },
 *   { [Kind]: 'post' },
 *   { [Kind]: 'user' }
 * ]
 *
 * const users = objects.filter(Obj.hasSymbolLikeWith(Kind, 'user'))
 * // Result: [{ [Kind]: 'user' }, { [Kind]: 'user' }]
 * ```
 */
export const hasSymbolLikeWith = (symbol: symbol, expectedValue: unknown) => (value: unknown): boolean => {
  return hasSymbolLike(value, symbol, expectedValue)
}

// dprint-ignore
export type PartialDeep<$Type> =
  $Type extends Array<infer __inner__>                  ? Array<PartialDeep<__inner__>> :
  $Type extends ReadonlyArray<infer __inner__>          ? ReadonlyArray<PartialDeep<__inner__>> :
  $Type extends Promise<infer __inner__>                ? Promise<PartialDeep<__inner__>> :
  $Type extends Function                                ? $Type :
  $Type extends object                                  ? {
                                                            [key in keyof $Type]?: PartialDeep<$Type[key]>
                                                          } :
                                                        // else
                                                          $Type

// Note: HasOptionalKeys moved to predicates.ts

// Note: OptionalKeys moved to predicates.ts

// Note: RequiredKeys moved to predicates.ts

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Constructors
//
//
//

/**
 * Convert an entries array type to an object type.
 *
 * @category Type Utilities
 */
// dprint-ignore
export type FromEntries<$Entries extends readonly (readonly [PropertyKey, unknown])[]> = {
  [k in $Entries[number] as k[0]]: k[1]
}

/**
 * Type-safe version of Object.fromEntries that preserves key types.
 *
 * Unlike `Object.fromEntries` which returns `{ [k: string]: V }`, this function
 * preserves the specific key literals when used with `as const` arrays.
 *
 * @category Constructors
 *
 * @param entries - Array of key-value pairs
 * @returns Object with preserved key types
 *
 * @example
 * ```ts
 * const entries = [['a', 1], ['b', 'hello']] as const
 * const obj = Obj.fromEntries(entries)
 * // obj: { a: 1, b: 'hello' }  ✅ Specific keys preserved!
 *
 * // Compare to Object.fromEntries:
 * const obj2 = Object.fromEntries(entries)
 * // obj2: { [k: string]: 1 | 'hello' }  ❌ Lost key specificity
 * ```
 *
 * @example
 * ```ts
 * // Works with dynamic entries too
 * const keys = ['x', 'y'] as const
 * const entries = keys.map(k => [k, k.toUpperCase()] as const)
 * const obj = Obj.fromEntries(entries)
 * // obj: { x: string, y: string }
 * ```
 */
export const fromEntries = <const $entries extends readonly (readonly [PropertyKey, unknown])[]>(
  entries: $entries,
): FromEntries<$entries> => Object.fromEntries(entries) as any

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Type Utilities
//
//
//

/**
 * Make all properties of an object writable (remove readonly modifiers).
 *
 * @category Type Utilities
 *
 * @example
 * ```ts
 * type ReadonlyUser = { readonly id: number; readonly name: string }
 * type WritableUser = Writeable<ReadonlyUser>
 * // Result: { id: number; name: string }
 * ```
 */
export type Writeable<$Obj extends object> = Writable<$Obj>

/**
 * Returns the same object but with a writable type.
 * Identity at runtime, removes readonly at type level.
 */
export const asWritable = <$obj extends object>(obj: $obj): Writeable<$obj> => obj as any

/**
 * Convert an object to a parameters tuple.
 *
 * @category Type Utilities
 */
// dprint-ignore
export type ToParameters<$Params extends object | undefined> =
  undefined extends $Params ? [params?: $Params] :
  $Params extends undefined ? [params?: $Params] :
                              [params: $Params]

/**
 * Convert an object to parameters tuple with exact matching.
 *
 * @category Type Utilities
 */
export type ToParametersExact<
  $Input extends object,
  $Params extends object | undefined,
> = IsEmpty<$Input> extends true ? []
  : ToParameters<$Params>

/**
 * Convert PropertyKey to string if possible.
 *
 * @category Type Utilities
 */
export type PropertyKeyToString<$Key extends PropertyKey> = $Key extends string ? $Key
  : $Key extends number ? `${$Key}`
  : never

/**
 * Display handler for symbol type.
 * @internal
 */
declare global {
  namespace KITZ.Traits.Display {
    interface Handlers<$Type> {
      _symbol: $Type extends symbol ? 'symbol' : never
    }
  }
}

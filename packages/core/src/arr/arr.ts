import { Bool } from '#bool'
import { CoreFn as Fn } from '#fn/core'
import { Obj } from '#obj'
import { Pat } from '#pat'
import { is } from './is.js'

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Types - Immutable (default)
//
//

/**
 * Unknown readonly array type. Use as a constraint for immutable arrays.
 */
export type Unknown = readonly unknown[]

/**
 * Any readonly array type. Use as a constraint for immutable arrays.
 */
export type Any = readonly any[]

/**
 * Empty readonly tuple type.
 */
export type Empty = readonly []

/**
 * Non-empty readonly array with at least one element.
 */
export type NonEmpty<$Type = any> = readonly [$Type, ...readonly $Type[]]

// Sized tuple types (immutable)
export type Any1 = readonly [any]
export type Any2 = readonly [any, any]
export type Any3 = readonly [any, any, any]
export type Any4 = readonly [any, any, any, any]
export type Any5 = readonly [any, any, any, any, any]

export type Any1OrMore = readonly [any, ...readonly any[]]
export type Any2OrMore = readonly [any, any, ...readonly any[]]
export type Any3OrMore = readonly [any, any, any, ...readonly any[]]
export type Any4OrMore = readonly [any, any, any, any, ...readonly any[]]
export type Any5OrMore = readonly [any, any, any, any, any, ...readonly any[]]

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Types - Mutable (explicit)
//
//

/**
 * Unknown mutable array type.
 */
export type UnknownMut = unknown[]

/**
 * Any mutable array type.
 */
export type AnyMut = any[]

/**
 * Empty mutable tuple type.
 */
export type EmptyMut = []

/**
 * Non-empty mutable array with at least one element.
 */
export type NonEmptyMut<$Type = any> = [$Type, ...$Type[]]

// Sized tuple types (mutable)
export type Any1Mut = [any]
export type Any2Mut = [any, any]
export type Any3Mut = [any, any, any]
export type Any4Mut = [any, any, any, any]
export type Any5Mut = [any, any, any, any, any]

export type Any1OrMoreMut = [any, ...any[]]
export type Any2OrMoreMut = [any, any, ...any[]]
export type Any3OrMoreMut = [any, any, any, ...any[]]
export type Any4OrMoreMut = [any, any, any, any, ...any[]]
export type Any5OrMoreMut = [any, any, any, any, any, ...any[]]

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Type Utilities
//
//

/**
 * Check if all booleans in a tuple are true.
 *
 * @category Type Utilities
 * @example
 * ```ts
 * type T1 = All<[true, true, true]>  // true
 * type T2 = All<[true, false, true]>  // false
 * ```
 */
export type All<$Tuple extends [...boolean[]]> = $Tuple[number] extends true ? true : false

/**
 * Check if a tuple has multiple elements.
 *
 * @category Type Utilities
 * @example
 * ```ts
 * type T1 = IsTupleMultiple<[1, 2]>  // true
 * type T2 = IsTupleMultiple<[1]>  // false
 * ```
 */
export type IsTupleMultiple<$T> = $T extends [unknown, unknown, ...unknown[]] ? true : false

/**
 * Push a value onto a tuple.
 *
 * @category Type Utilities
 * @example
 * ```ts
 * type T = Push<[1, 2], 3>  // [1, 2, 3]
 * ```
 */
export type Push<$T extends any[], $V> = [...$T, $V]

/**
 * Get the first non-unknown, non-never element from a tuple.
 *
 * @category Type Utilities
 */
export type FirstNonUnknownNever<$T extends any[]> = $T extends [infer __first__, ...infer __rest__]
  ? unknown extends __first__ ? 0 extends 1 & __first__ ? FirstNonUnknownNever<__rest__> // is any
    : FirstNonUnknownNever<__rest__> // is unknown
  : __first__ extends never ? FirstNonUnknownNever<__rest__>
  : __first__
  : never

/**
 * Type-level filter utility that removes specific types from a tuple.
 *
 * @example
 * ```ts
 * type T1 = Omit<[1, 'a', 2, 'b', 3], string> // [1, 2, 3]
 * type T2 = Omit<[1, never, 2, never, 3], never> // [1, 2, 3]
 * type T3 = Omit<['a', 'b', 'c'], number> // ['a', 'b', 'c']
 * ```
 */
export type Omit<$Tuple extends readonly any[], $Exclude> = $Tuple extends readonly [infer First, ...infer Rest]
  ? First extends $Exclude ? Omit<Rest, $Exclude>
  : [First, ...Omit<Rest, $Exclude>]
  : []

/**
 * A value that can be either a single item or an array of items.
 */
export type Maybe<$Type> = $Type | $Type[]

// dprint-ignore
export type FlattenShallow<$Type> =
  $Type extends (infer __inner_type__)[]
    ? __inner_type__
    : $Type

// dprint-ignore
export type ReplaceInner<$Array extends AnyMut, $NewType> =
    $Array extends Any2Mut       ? [$NewType, $NewType]
  : $Array extends Any3Mut       ? [$NewType, $NewType, $NewType]
  : $Array extends Any4Mut       ? [$NewType, $NewType, $NewType, $NewType]
  : $Array extends Any5Mut       ? [$NewType, $NewType, $NewType, $NewType, $NewType]
  : $Array extends NonEmptyMut      ? NonEmptyMut<$NewType>
                                 : $NewType[]

export type JsMapper<
  $Array extends AnyMut,
  $NewType,
> = (value: $Array[number], index: number) => $NewType

// dprint-ignore
export type ReduceWithIntersection<$Items extends Unknown> =
  $Items extends readonly [infer First, ...infer Rest]
    ? First & ReduceWithIntersection<Rest>
    : $Items extends Empty
      ? {}
      // Means we got something like {x:1}[]
      // in which case we just strip the array
      : $Items[number]

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Constants
//
//

/**
 * Empty array constant (frozen).
 * Useful as a default value or sentinel.
 *
 * @category Constants
 * @example
 * ```ts
 * const arr = items ?? Arr.empty
 * ```
 */
export const empty: Empty = Object.freeze([]) as Empty

/**
 * Type for the empty array constant.
 */
export type EmptyArray = typeof empty

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Freeze Utilities
//
//

/**
 * Create a frozen (immutable) array from the given items.
 *
 * @category Construction
 * @example
 * ```ts
 * const arr = Arr.of(1, 2, 3)  // readonly [1, 2, 3], frozen
 * ```
 */
export const of = <$T extends readonly unknown[]>(...items: $T): Readonly<$T> => {
  return Obj.toImmutableMut(items)
}

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Type Guards
//
//

/**
 * Assert that a value is an array.
 * Throws a TypeError if the value is not an array.
 *
 * @category Type Guards
 * @param value - The value to check
 * @throws {TypeError} If the value is not an array
 *
 * @example
 * ```ts
 * function process(value: unknown) {
 *   Arr.assert(value)
 *   // value is now typed as unknown[]
 *   value.forEach(item => console.log(item))
 * }
 * ```
 */
export function assert(value: unknown): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`Expected array but got ${typeof value}`)
  }
}

export { is }

/**
 * Type predicate to check if an array is empty.
 * @param array - The array to check
 * @returns True if the array is empty.
 * @example
 * ```ts
 * isEmpty([]) // true
 * isEmpty([1, 2, 3]) // false
 * ```
 */
export const isEmpty = (array: unknown[]): array is EmptyMut => {
  return array.length === 0
}

/**
 * Type predicate to check if an array is not empty.
 * @param array - The array to check
 * @returns True if the array is not empty.
 * @example
 * ```ts
 * isntEmpty([1, 2, 3]) // true
 * isntEmpty([]) // false
 * if (isntEmpty(arr)) {
 *   const first = arr[0] // guaranteed to exist
 * }
 * ```
 */
export const isntEmpty = <value>(array: value[]): array is NonEmptyMut<value> => {
  return array.length > 0
}

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Construction
//
//

/**
 * Create a new empty array of the specified type.
 * @returns A new empty array.
 * @example
 * ```ts
 * const numbers = create<number>() // number[]
 * const strings = create<string>() // string[]
 * ```
 */
export const create = <item>(): item[] => {
  return [] as any
}

/**
 * Ensure a value is an array.
 * If the value is already an array, return it as-is.
 * Otherwise, wrap it in an array.
 *
 * @category Normalization
 * @param value - The value to ensure as array
 * @returns An array containing the value(s)
 * @example
 * ```ts
 * Arr.ensure('hello')  // ['hello']
 * Arr.ensure(['a', 'b'])  // ['a', 'b']
 * Arr.ensure(42)  // [42]
 * ```
 */
export const ensure = <$T>(value: $T | $T[]): $T[] => {
  return Array.isArray(value) ? value : [value]
}

/**
 * Ensure a value is an array. Alias for {@link ensure}.
 * @param value - The value to ensure is an array
 * @returns The value as an array.
 * @example
 * ```ts
 * sure([1, 2, 3]) // [1, 2, 3]
 * sure(42) // [42]
 * sure('hello') // ['hello']
 * ```
 */
export const sure = <value>(value: value): sure<value> => {
  return is(value) ? value as any : [value] as any
}

export type sure<$Type> = $Type extends AnyMut ? $Type : $Type[]

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Access
//
//

/**
 * Get an element at a specific index.
 * @param array - The array to access
 * @param index - The index to access
 * @returns The element at the index, or undefined if out of bounds.
 * @example
 * ```ts
 * getAt(['a', 'b', 'c'], 1) // 'b'
 * getAt(['a', 'b', 'c'], 5) // undefined
 * getAt(['a', 'b', 'c'], -1) // undefined
 * ```
 */
export const getAt = <item>(array: readonly item[], index: number): item | undefined => {
  return array[index]
}

/**
 * Get the first element of an array.
 * @param array - The array to access
 * @returns The first element, or undefined for empty arrays.
 * @example
 * ```ts
 * getFirst([1, 2, 3]) // 1
 * getFirst([]) // undefined
 * ```
 */
export const getFirst = <item>(array: readonly item[]): item | undefined => {
  return array[0]
}

/**
 * Get the last element of an array.
 *
 * @category Access
 * @param array - The array to get the last element from
 * @returns The last element, or `undefined` if the array is empty
 * @example
 * ```ts
 * Arr.getLast([1, 2, 3])  // 3
 * Arr.getLast(['a'])  // 'a'
 * Arr.getLast([])  // undefined
 * ```
 */
export const getLast = <$T>(array: readonly $T[]): $T | undefined => {
  return array[array.length - 1]
}

/**
 * Alias for {@link getLast}.
 */
export const last = getLast

/**
 * Get a random index from an array.
 * @param arr - The array to get a random index from
 * @returns A random valid index, or undefined for empty arrays.
 * @example
 * ```ts
 * randomIndex([1, 2, 3, 4, 5]) // 0-4 (random)
 * randomIndex([]) // undefined
 * ```
 */
export const randomIndex = <const arr extends Any>(arr: arr): arr extends Any1OrMore ? number : undefined => {
  return Math.floor(Math.random() * arr.length) as any
}

/**
 * Get a random element from an array.
 * @param arr - The array to get a random element from
 * @returns A random element, or undefined for empty arrays.
 * @example
 * ```ts
 * getRandomly([1, 2, 3, 4, 5]) // 1-5 (random)
 * getRandomly(['a', 'b', 'c']) // 'a', 'b', or 'c' (random)
 * getRandomly([]) // undefined
 * ```
 */
export const getRandomly = <const arr extends Any>(
  arr: arr,
): arr[number] | (arr extends Any1OrMore ? never : undefined) => {
  if (arr.length === 0) return undefined
  return arr[randomIndex(arr)!]
}

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Search
//
//

/**
 * Type-safe array includes check that narrows the type of the value.
 * Unlike the standard `includes`, this provides proper type narrowing.
 *
 * @category Search
 * @param array - The array to search in
 * @param value - The unknown value to search for
 * @returns True if the value is in the array, with type narrowing
 * @example
 * ```ts
 * const fruits = ['apple', 'banana', 'orange'] as const
 * const value: unknown = 'apple'
 *
 * if (Arr.includes(fruits, value)) {
 *   // value is now typed as 'apple' | 'banana' | 'orange'
 * }
 * ```
 */
export const includes = <$T>(array: $T[], value: unknown): value is $T => {
  return array.includes(value as any)
}

/**
 * Alias for {@link includes}.
 */
export const includesUnknown = includes

/**
 * Find the first element in an array that matches a predicate.
 * @param arr - The array to search
 * @param predicate - Predicate function or value to match
 * @returns The found element or undefined.
 * @example
 * ```ts
 * find([1, 2, 3], x => x > 2) // 3
 * find(['a', 'b', 'c'], 'b') // 'b'
 * find([1, 2, 3], x => x > 10) // undefined
 * ```
 */
export const find = <value>(arr: value[], predicate: Bool.PredicateMaybe<value>): value | undefined => {
  const predicate_ = Bool.ensurePredicate(predicate)
  return arr.find((value) => {
    return predicate_(value as any)
  })
}

/**
 * Find the first element in an array that matches a pattern.
 * @param arr - The array to search
 * @param pattern - Pattern to match against
 * @returns The found element or undefined.
 * @example
 * ```ts
 * findFirstMatching([{ id: 1 }, { id: 2 }], { id: 2 }) // { id: 2 }
 * findFirstMatching(['hello', 'world'], /^w/) // 'world'
 * ```
 */
export const findFirstMatching = <value>(arr: value[], pattern: Pat.Pattern<value>): value | undefined => {
  return arr.find(Pat.isMatchWith(pattern))
}

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Comparison
//
//

/**
 * Check that one array is structurally equal _one level deep_. This means items are compared with strict equality operator (`===`).
 *
 * @param array1 Must be subtype of {@link array2}
 * @param array2 Array to check against. Must be supertype of {@link array1}.
 *
 * @returns True if arrays are equal.
 */
export const equalShallowly = <array1_ extends AnyMut, array2_ extends array1_>(
  array1: array1_,
  array2: array2_,
): array1 is array2_ => {
  if (array1.length !== array2.length) return false
  for (let i = 0; i < array1.length; i++) {
    if (array1[i] !== array2[i]) return false
  }
  return true
}

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Transformation
//
//

/**
 * Map over an array with a function, preserving array shape.
 * Frozen arrays produce a new frozen array; mutable arrays produce a mutable array.
 *
 * @param $array - The array to map over
 * @param fn - The mapping function
 * @returns A new array with mapped values.
 * @example
 * ```ts
 * map([1, 2, 3], x => x * 2) // [2, 4, 6]
 * map(['a', 'b'], (s, i) => `${s}${i}`) // ['a0', 'b1']
 * ```
 */
export const map = <$array extends Any, newType>(
  $array: $array,
  fn: (value: $array[number], index: number) => newType,
): ReplaceInner<$array & AnyMut, newType> => {
  return Obj.forwardImmutability($array, $array.map(fn)) as any
}

/**
 * Curried version of {@link map} with array first.
 * Frozen arrays produce a new frozen array; mutable arrays produce a mutable array.
 *
 * @param array - The array to map over
 * @returns Function that takes a mapper and returns the mapped array.
 * @example
 * ```ts
 * const mapNumbers = mapOn([1, 2, 3])
 * mapNumbers(x => x * 2) // [2, 4, 6]
 * ```
 */
// dprint-ignore
export const mapOn =
  <array extends Any>(array: array) =>
  <newType>(fn: (value: array[number], index: number) => newType): ReplaceInner<array & AnyMut, newType> => {
    return map(array, fn)
  }

/**
 * Curried version of {@link map} with mapper first.
 * Frozen arrays produce a new frozen array; mutable arrays produce a mutable array.
 *
 * @param fn - The mapping function
 * @returns Function that takes an array and returns the mapped array.
 * @example
 * ```ts
 * const double = mapWith((x: number) => x * 2)
 * double([1, 2, 3]) // [2, 4, 6]
 * ```
 */
// dprint-ignore
export const mapWith =
  <$T, newType>(fn: (value: $T, index: number) => newType) =>
  <array extends readonly $T[]>(array: array): ReplaceInner<array & AnyMut, newType> => {
    return map(array, fn as any)
  }

/**
 * Transpose a 2D array (convert rows to columns and vice versa).
 * This is a classic matrix transpose operation.
 * Frozen arrays produce a new frozen array; mutable arrays produce a mutable array.
 *
 * Handles ragged arrays (rows with different lengths) by creating columns
 * that only contain elements from rows that had values at that position.
 *
 * @category Transformation
 * @param rows - The 2D array to transpose
 * @returns The transposed 2D array
 * @example
 * ```ts
 * const rows = [
 *   [1, 2, 3],
 *   [4, 5, 6]
 * ]
 * Arr.transpose(rows)
 * // [[1, 4], [2, 5], [3, 6]]
 *
 * const table = [
 *   ['Alice', 'Engineer', '100k'],
 *   ['Bob', 'Designer', '90k']
 * ]
 * Arr.transpose(table)
 * // [['Alice', 'Bob'], ['Engineer', 'Designer'], ['100k', '90k']]
 *
 * // Ragged array (uneven row lengths)
 * const ragged = [[1, 2, 3], [4, 5]]
 * Arr.transpose(ragged)
 * // [[1, 4], [2, 5], [3]]
 * ```
 */
export const transpose = <$T>(rows: readonly (readonly $T[])[]): $T[][] => {
  const columns: $T[][] = []
  for (const row of rows) {
    let i = 0
    for (const cell of row) {
      const column = columns[i] || []
      column.push(cell)
      columns[i] = column
      i++
    }
  }
  return Obj.forwardImmutability(rows, columns) as any
}

/**
 * Remove duplicate values from an array.
 * Frozen arrays get a new deduplicated frozen array.
 * Mutable arrays are deduplicated in place.
 *
 * @param arr - The array to deduplicate
 * @returns The deduplicated array.
 * @example
 * ```ts
 * dedupe([1, 2, 2, 3, 3, 3]) // [1, 2, 3]
 * dedupe(['a', 'b', 'a', 'c']) // ['a', 'b', 'c']
 * ```
 */
export const dedupe = <$arr extends readonly unknown[]>(arr: $arr): $arr => {
  if (Obj.isImmutable(arr)) {
    return Obj.toImmutableMut([...new Set(arr)]) as $arr
  }
  // Mutable: dedupe in place
  const mutableArr = arr as any
  let i = 0
  const seen = new Set<unknown>()

  while (i < mutableArr.length) {
    const item = mutableArr[i]
    if (seen.has(item)) {
      mutableArr.splice(i, 1)
    } else {
      seen.add(item)
      i++
    }
  }

  return arr
}

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Partitioning
//
//

/**
 * Partition an array into two arrays based on a predicate.
 * Frozen arrays produce new frozen arrays; mutable arrays produce mutable arrays.
 *
 * @param items - The array to partition
 * @param predicate - Predicate to test elements
 * @returns Tuple of [non-matching items, matching items].
 * @example
 * ```ts
 * const isEven = (n: number): n is number => n % 2 === 0
 * const [odds, evens] = partition([1, 2, 3, 4], isEven)
 * // odds: [1, 3], evens: [2, 4]
 * ```
 */
export function partition<item, itemSub extends item>(
  items: readonly item[],
  predicate: (value: item) => value is itemSub,
): [Exclude<item, itemSub>[], itemSub[]]
export function partition<item>(
  items: readonly item[],
  predicate: (value: item) => boolean,
): [item[], item[]]
export function partition<item>(
  items: readonly item[],
  predicate: (value: item) => boolean,
): [item[], item[]] {
  const itemsA: item[] = []
  const itemsB: item[] = []

  for (const value of items) {
    if (predicate(value)) itemsB.push(value)
    else itemsA.push(value)
  }

  if (Obj.isImmutable(items)) {
    return Obj.toImmutableMut([Obj.toImmutableMut(itemsA), Obj.toImmutableMut(itemsB)]) as any
  }
  return [itemsA, itemsB]
}

/**
 * Partition an array into two arrays based on a predicate, expecting at most one match.
 * Frozen arrays produce new frozen arrays; mutable arrays produce mutable arrays.
 *
 * @param items - The array to partition
 * @param predicate - Type predicate to test elements
 * @returns Tuple of [non-matching items, matched item or null].
 * @throws Error if more than one item matches the predicate
 * @example
 * ```ts
 * const isError = (x: unknown): x is Error => x instanceof Error
 * const [values, error] = partitionOne([1, new Error(), 2], isError)
 * // values: number[], error: Error | null
 * ```
 */
export const partitionOne = <item, itemSub extends item>(
  items: readonly item[],
  predicate: (value: item) => value is itemSub,
): [Exclude<item, itemSub>[], itemSub | null] => {
  const [itemsA, itemsB] = partition(items, predicate)
  if (itemsB.length > 1) throw new Error(`Expected at most one item to match predicate`)

  return [itemsA, itemsB[0] ?? null]
}

/**
 * Partition an array into values and errors.
 * Frozen arrays produce new frozen arrays; mutable arrays produce mutable arrays.
 *
 * @param array - The array to partition
 * @returns Tuple of [non-error values, errors].
 * @example
 * ```ts
 * const [values, errors] = partitionErrors([1, new Error('oops'), 'hello', new Error('fail')])
 * // values: [1, 'hello'], errors: [Error('oops'), Error('fail')]
 * ```
 */
export const partitionErrors = <T>(array: readonly T[]): [Exclude<T, Error>[], Extract<T, Error>[]] => {
  const errors: Extract<T, Error>[] = []
  const values: Exclude<T, Error>[] = []
  for (const item of array) {
    if (item instanceof Error) {
      errors.push(item as any)
    } else {
      values.push(item as any)
    }
  }
  if (Obj.isImmutable(array)) {
    return Obj.toImmutableMut([Obj.toImmutableMut(values), Obj.toImmutableMut(errors)]) as any
  }
  return [values, errors]
}

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Joining
//
//

/**
 * Join array elements into a string with a separator.
 * @param values - The array to join
 * @param separator - The separator string
 * @returns The joined string.
 * @example
 * ```ts
 * join(['a', 'b', 'c'], ',') // 'a,b,c'
 * join([1, 2, 3], ' - ') // '1 - 2 - 3'
 * ```
 */
export const join = (values: unknown[], separator: string): string => {
  return values.join(separator)
}

/**
 * Curried version of {@link join} with values first.
 * @param values - The array to join
 * @returns Function that takes separator and returns the joined string.
 */
export const joinOn = Fn.curry(join)

/**
 * Curried version of {@link join} with separator first.
 * @param separator - The separator string
 * @returns Function that takes values and returns the joined string.
 * @example
 * ```ts
 * const joinWithComma = joinWith(',')
 * joinWithComma(['a', 'b', 'c']) // 'a,b,c'
 * ```
 */
export const joinWith = Fn.flipCurried(joinOn)

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Merging
//
//

/**
 * Merge two arrays into a new array.
 * Frozen arrays produce a new frozen array; mutable arrays produce a mutable array.
 * If either input is frozen, the result is frozen.
 *
 * @param array1 - The first array
 * @param array2 - The second array
 * @returns A new array containing all elements from both arrays.
 * @example
 * ```ts
 * merge([1, 2], [3, 4]) // [1, 2, 3, 4]
 * merge(['a'], ['b', 'c']) // ['a', 'b', 'c']
 * ```
 */
export const merge = <T>(array1: readonly T[], array2: readonly T[]): T[] => {
  const result = (array1 as T[]).concat(array2 as T[])
  // If either input is frozen, freeze the result (in place - it's freshly created)
  if (Obj.isImmutable(array1) || Obj.isImmutable(array2)) {
    return Obj.toImmutableMut(result) as T[]
  }
  return result
}

/**
 * Curried version of {@link merge} with array1 first.
 * Frozen arrays produce a new frozen array; mutable arrays produce a mutable array.
 *
 * @param array1 - The first array
 * @returns Function that takes array2 and returns the merged array.
 * @example
 * ```ts
 * const mergeWithBase = mergeOn([1, 2])
 * mergeWithBase([3, 4]) // [1, 2, 3, 4]
 * ```
 */
export const mergeOn = Fn.curry(merge)

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Display Trait
//
//

/**
 * Display handlers for Array types.
 * @internal
 */

import { Optic } from '#optic'
import type { Display } from '#ts/ts'

declare global {
  namespace KITZ.Traits.Display {
    // dprint-ignore
    interface Handlers<$Type> {
      // Array (mutable)
      _array: $Type extends (infer __element__)[] ? `Array<${Display<__element__>}>` : never
      // ReadonlyArray - only matches if NOT also a mutable array
      _readonlyArray: $Type extends readonly (infer __element__)[]
        ? $Type extends (infer __unused__)[]
          ? never  // It's mutable, let _array handler win
          : `ReadonlyArray<${Display<__element__>}>`
        : never
    }
  }
}

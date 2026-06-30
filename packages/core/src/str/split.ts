import { curry, flipCurried } from '#fn/fn'
import { Empty } from './type.js'

/**
 * Split a string into an array of substrings using a separator.
 * @category Transformation
 * @deprecated Use {@link String.split} from Effect instead
 * @param value - The string to split
 * @param separator - The separator to split on
 * @returns Array of substrings
 * @example
 * ```typescript
 * split('a,b,c', ',') // ['a', 'b', 'c']
 * split('hello world', ' ') // ['hello', 'world']
 * split('', ',') // ['']
 * ```
 */
export const split = (value: string, separator: string): string[] => {
  return value.split(separator)
}

/**
 * Curried version of {@link split} with value first.
 * @category Transformation
 * @param value - The string to split
 * @returns Function that takes separator and returns array of substrings
 */
export const splitOn = curry(split)

/**
 * Curried version of {@link split} with separator first.
 * @category Transformation
 * @param separator - The separator to split on
 * @returns Function that takes value and returns array of substrings
 * @example
 * ```typescript
 * const splitByComma = splitWith(',')
 * splitByComma('a,b,c') // ['a', 'b', 'c']
 * ```
 */
export const splitWith = flipCurried(splitOn)

/**
 * Join an array of strings into a single string with a separator.
 * @category Transformation
 * @deprecated Use {@link Array.join} from Effect instead
 * @param value - Array of strings to join
 * @param separator - The separator to place between strings
 * @returns The joined string
 * @example
 * ```typescript
 * join(['a', 'b', 'c'], ',') // 'a,b,c'
 * join(['hello', 'world'], ' ') // 'hello world'
 * join([], ',') // ''
 * ```
 */
export const join = (value: string[], separator: string): string => {
  return value.join(separator)
}

/**
 * Curried version of {@link join} with value first.
 * @category Transformation
 * @param value - Array of strings to join
 * @returns Function that takes separator and returns the joined string
 */
export const joinOn = curry(join)

/**
 * Curried version of {@link join} with separator first.
 * @category Transformation
 * @param separator - The separator to place between strings
 * @returns Function that takes array and returns the joined string
 * @example
 * ```typescript
 * const joinWithComma = joinWith(',')
 * joinWithComma(['a', 'b', 'c']) // 'a,b,c'
 * ```
 */
export const joinWith = flipCurried(joinOn)

/**
 * Merge two strings together (concatenate).
 * @category Transformation
 * @deprecated Use {@link String.concat} from Effect instead
 * @param string1 - The first string
 * @param string2 - The second string
 * @returns The concatenated string
 * @example
 * ```typescript
 * merge('hello', ' world') // 'hello world'
 * merge('foo', 'bar') // 'foobar'
 * ```
 */
export const merge = (string1: string, string2: string): string => {
  return string1 + string2
}

/**
 * Curried version of {@link merge} with string1 first.
 * @category Transformation
 * @param string1 - The first string
 * @returns Function that takes string2 and returns the concatenated string
 * @example
 * ```typescript
 * const mergeWithHello = mergeOn('hello')
 * mergeWithHello(' world') // 'hello world'
 * ```
 */
export const mergeOn = curry(merge)

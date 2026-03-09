import { curry, flipCurried } from '#fn/fn'
import { Ts } from '#ts'
import type { Regex } from 'arkregex'
import { Char } from './char/_.js'
import type { RegexMatch } from './match.js'
import { Empty } from './type.js'

// ============================================================================
// Replacement Types
// ============================================================================

/**
 * Replacement input for typed Regex patterns.
 * @category Replacement
 */
export type ReplacementInput<$Regex extends Regex = Regex> = string | ReplacementCallback<$Regex>

/**
 * Replacement input for untyped RegExp patterns.
 * @category Replacement
 */
export type ReplacementInputUntyped = string | ReplacementCallbackUntyped

/**
 * Typed callback for Regex patterns - receives {@link RegexMatch} with typed captures.
 * @category Replacement
 */
export type ReplacementCallback<$Regex extends Regex = Regex> = (
  match: RegexMatch<$Regex>,
) => string

/**
 * Untyped callback for RegExp patterns - escape hatch for legacy code.
 * @category Replacement
 */
export type ReplacementCallbackUntyped = (match: string, ...args: any[]) => string

/**
 * Conditional replacement type based on pattern type.
 * @internal
 */
// oxfmt-ignore
export type ReplacementFor<$P> =
  $P extends Regex ? ReplacementInput<$P> :
  $P extends RegExp ? ReplacementInputUntyped :
                      string

/**
 * Validates pattern for `replaceAll` - ensures Regex has global flag.
 * Returns StaticError for Regex without 'g' flag.
 * @internal
 */
// oxfmt-ignore
export type ValidatePatternAll<$P> =
  $P extends Regex
    ? $P['flags'] extends `${string}g${string}`
      ? $P
      : Ts.Err.StaticError<'regex-missing-global-flag', { flags: $P['flags'] }>
    : $P

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Builtins
//
//

/**
 * Remove whitespace from both ends of a string.
 * @category Transformation
 * @deprecated Use {@link String.trim} from Effect instead
 * @param value - The string to trim
 * @returns The trimmed string
 * @example
 * ```typescript
 * trim('  hello  ') // 'hello'
 * trim('\n\thello\n\t') // 'hello'
 * ```
 */
export const trim = (value: string): string => {
  return value.trim()
}

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • replaceLeading
//
//

/**
 * Replace the leading occurrence of a matcher string with a replacement.
 * @category Transformation
 * @param replacement - The string to replace the matcher with
 * @param matcher - The string to match at the beginning
 * @param value - The string to operate on
 * @returns The string with leading matcher replaced
 * @example
 * ```typescript
 * replaceLeading('$', '//', '// comment') // '$ comment'
 * replaceLeading('', 'www.', 'www.example.com') // 'example.com'
 * ```
 */
export const replaceLeading = (replacement: string, matcher: string, value: string): string => {
  if (!value.startsWith(matcher)) return value
  return replacement + value.slice(matcher.length)
}

/**
 * Curried version of {@link replaceLeading} with replacement first.
 * @category Transformation
 * @param replacement - The string to replace the matcher with
 * @returns Function that takes matcher, then value
 */
export const replaceLeadingWith =
  (replacement: string) =>
  (matcher: string) =>
  (value: string): string => {
    return replaceLeading(replacement, matcher, value)
  }

/**
 * Curried version of {@link replaceLeading} with value first.
 * @category Transformation
 * @param value - The string to operate on
 * @returns Function that takes replacement, then matcher
 */
export const replaceLeadingOn =
  (value: string) =>
  (replacement: string) =>
  (matcher: string): string => {
    return replaceLeading(replacement, matcher, value)
  }

/**
 * Remove the leading occurrence of a matcher string.
 * Alias for `replaceLeadingWith('')`.
 * @category Transformation
 * @param matcher - The string to remove from the beginning
 * @returns Function that takes a value and returns the stripped string
 * @example
 * ```typescript
 * const removePrefix = stripLeading('//')
 * removePrefix('// comment') // ' comment'
 * ```
 */
export const stripLeading = replaceLeadingWith(``)

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • replace
//
//

/**
 * Replace matches in a string with a replacement.
 *
 * @category Transformation
 * @param value - The string to operate on
 * @param pattern - Pattern(s) to match
 * @param replacement - String or callback replacement (typed for Regex patterns)
 * @returns The string with replacements applied
 *
 * @example
 * ```typescript
 * // String pattern
 * replace('hello world', ' ', '_')  // 'hello_world'
 *
 * // Typed Regex with callback
 * const p = pattern("(?<name>\\w+)@(?<domain>\\w+)")
 * replace('user@example.com', p, (m) => {
 *   return `${m.groups.name} at ${m.groups.domain}`
 * })
 * ```
 */
export function replace<$P extends string | string[] | RegExp | Regex>(
  value: string,
  pattern: $P,
  replacement: ReplacementFor<$P>,
): string
export function replace(
  value: string,
  pattern: string | string[] | RegExp | Regex,
  replacement: string | ReplacementCallback | ReplacementCallbackUntyped,
): string {
  // Handle array of string patterns
  if (Array.isArray(pattern)) {
    return pattern.reduce<string>((acc, p) => {
      return acc.replaceAll(p, replacement as string)
    }, value)
  }

  // Handle single string pattern
  if (typeof pattern === 'string') {
    return value.replaceAll(pattern, replacement as string)
  }

  // Handle RegExp or Regex with callback wrapper
  if (typeof replacement === 'function') {
    return value.replace(pattern as RegExp, (value: string, ...args: any[]) => {
      // Native callback: (match, ...captures, offset, string, groups?)
      // Find offset (first number after match) to split captures from metadata
      const offsetIdx = args.findIndex((arg) => typeof arg === 'number')
      const captures = args.slice(0, offsetIdx)
      const offset = args[offsetIdx] as number
      const input = args[offsetIdx + 1] as string
      const groups = args[offsetIdx + 2] as Record<string, string | undefined> | undefined

      return (replacement as ReplacementCallback)({
        value,
        offset,
        captures,
        groups: groups ?? {},
        input,
      } as any)
    })
  }

  // Handle RegExp or Regex with string replacement
  return value.replace(pattern as RegExp, replacement)
}

/**
 * Curried version of {@link replace} with value first.
 * @category Transformation
 */
export const replaceOn = curry(replace)

/**
 * Curried version of {@link replace} with pattern and replacement first.
 * @category Transformation
 */
export const replaceWith =
  <$P extends string | string[] | RegExp | Regex>(pattern: $P, replacement: ReplacementFor<$P>) =>
  (value: string): string => {
    return replace(value, pattern as any, replacement as any)
  }

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • replaceAll
//
//

/**
 * Replace all matches in a string with a replacement.
 * For typed Regex patterns, requires the global flag (enforced at type level).
 *
 * @category Transformation
 * @param value - The string to operate on
 * @param pattern - Pattern(s) to match (Regex requires 'g' flag)
 * @param replacement - String or callback replacement
 * @returns The string with all replacements applied
 *
 * @example
 * ```typescript
 * // String pattern (always replaces all)
 * replaceAll('a-b-a', 'a', 'X')  // 'X-b-X'
 *
 * // Typed Regex with global flag
 * const p = pattern("\\d+", "g")
 * replaceAll('a1b2c3', p, m => `[${m.value}]`)  // 'a[1]b[2]c[3]'
 *
 * // Non-global Regex causes type error
 * const bad = pattern("\\d+")
 * replaceAll('a1b2', bad, 'X')  // ❌ Type error: missing 'g' flag
 * ```
 */
export function replaceAll<$P extends string | string[] | RegExp | Regex>(
  value: string,
  pattern: ValidatePatternAll<$P>,
  replacement: ReplacementFor<$P>,
): string
export function replaceAll(
  value: string,
  pattern: string | string[] | RegExp | Regex,
  replacement: string | ReplacementCallback | ReplacementCallbackUntyped,
): string {
  // Handle array of string patterns
  if (Array.isArray(pattern)) {
    return pattern.reduce<string>((acc, p) => {
      return acc.replaceAll(p, replacement as string)
    }, value)
  }

  // Handle single string pattern
  if (typeof pattern === 'string') {
    return value.replaceAll(pattern, replacement as string)
  }

  // Handle RegExp or Regex with callback wrapper
  if (typeof replacement === 'function') {
    return value.replaceAll(pattern as RegExp, (match: string, ...args: any[]) => {
      // Native callback: (match, ...captures, offset, string, groups?)
      // Find offset (first number after match) to split captures from metadata
      const offsetIdx = args.findIndex((arg) => typeof arg === 'number')
      const captures = args.slice(0, offsetIdx)
      const offset = args[offsetIdx] as number
      const input = args[offsetIdx + 1] as string
      const groups = args[offsetIdx + 2] as Record<string, string | undefined> | undefined

      return (replacement as ReplacementCallback)({
        value: match,
        offset,
        captures,
        groups: groups ?? {},
        input,
      } as any)
    })
  }

  // Handle RegExp or Regex with string replacement
  return value.replaceAll(pattern as RegExp, replacement)
}

/**
 * Curried version of {@link replaceAll} with value first.
 * @category Transformation
 */
export const replaceAllOn = curry(replaceAll)

/**
 * Curried version of {@link replaceAll} with pattern and replacement first.
 * @category Transformation
 */
export const replaceAllWith =
  <$P extends string | string[] | RegExp | Regex>(
    pattern: ValidatePatternAll<$P>,
    replacement: ReplacementFor<$P>,
  ) =>
  (value: string): string => {
    return replaceAll(value, pattern as any, replacement as any)
  }

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • append
//
//

/**
 * Append a string to another string.
 * @category Transformation
 * @deprecated Use {@link String.concat} from Effect instead
 * @param value1 - The base string
 * @param value2 - The string to append
 * @returns The concatenated string
 * @example
 * ```typescript
 * append('hello', ' world') // 'hello world'
 * append('foo', 'bar') // 'foobar'
 * ```
 */
export const append = (value1: string, value2: string): string => {
  return value1 + value2
}

/**
 * Curried version of {@link append} with value1 first.
 * @category Transformation
 * @param value1 - The base string
 * @returns Function that takes value2 and returns the concatenated string
 */
export const appendOn = curry(append)

/**
 * Curried version of {@link append} with value2 first.
 * @category Transformation
 * @param value2 - The string to append
 * @returns Function that takes value1 and returns the concatenated string
 * @example
 * ```typescript
 * const addWorld = appendWith(' world')
 * addWorld('hello') // 'hello world'
 * ```
 */
export const appendWith = flipCurried(appendOn)

// prepend

/**
 * Prepend a string to another string.
 * @category Transformation
 * @deprecated Use {@link String.concat} from Effect instead (with arguments swapped)
 * @param value1 - The string to prepend
 * @param value2 - The base string
 * @returns The concatenated string with value1 first
 * @example
 * ```typescript
 * prepend('hello ', 'world') // 'hello world'
 * prepend('pre', 'fix') // 'prefix'
 * ```
 */
export const prepend = (value1: string, value2: string): string => {
  return value2 + value1
}

/**
 * Curried version of {@link prepend} with value1 first.
 * @category Transformation
 * @param value1 - The string to prepend
 * @returns Function that takes value2 and returns the concatenated string
 */
export const prependOn = curry(prepend)

/**
 * Curried version of {@link prepend} with value2 first.
 * @category Transformation
 * @param value2 - The base string
 * @returns Function that takes value1 and returns the concatenated string
 * @example
 * ```typescript
 * const toWorld = prependWith('world')
 * toWorld('hello ') // 'hello world'
 * ```
 */
export const prependWith = flipCurried(prependOn)

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • repeat
//
//

/**
 * Repeat a string a specified number of times.
 * @category Transformation
 * @deprecated Use {@link String.repeat} from Effect instead
 * @param value - The string to repeat
 * @param count - The number of times to repeat
 * @returns The repeated string
 * @example
 * ```typescript
 * repeat('a', 3) // 'aaa'
 * repeat('hello', 2) // 'hellohello'
 * repeat('-', 10) // '----------'
 * ```
 */
export const repeat = (value: string, count: number): string => {
  return value.repeat(count)
}

/**
 * Curried version of {@link repeat} with value first.
 * @category Transformation
 * @param value - The string to repeat
 * @returns Function that takes count and returns the repeated string
 */
export const repeatOn = curry(repeat)

/**
 * Curried version of {@link repeat} with count first.
 * @category Transformation
 * @param count - The number of times to repeat
 * @returns Function that takes value and returns the repeated string
 * @example
 * ```typescript
 * const triple = repeatWith(3)
 * triple('ha') // 'hahaha'
 * ```
 */
export const repeatWith = flipCurried(repeatOn)

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • removeSurrounding
//
//

/**
 * Remove all occurrences of a target character from the beginning and end of a string.
 * @category Transformation
 * @param str - The string to process
 * @param target - The character to remove from both ends
 * @returns The string with surrounding target characters removed
 * @example
 * ```typescript
 * removeSurrounding('   hello   ', ' ') // 'hello'
 * removeSurrounding('***test***', '*') // 'test'
 * removeSurrounding('aaa', 'a') // ''
 * ```
 */
export const removeSurrounding = (str: string, target: string): string => {
  if (!str) return str

  let start = 0
  let end = str.length - 1

  // Remove from start
  while (start <= end && str[start] === target) {
    start++
  }

  // Remove from end
  while (end >= start && str[end] === target) {
    end--
  }

  // Return remaining portion
  return start > 0 || end < str.length - 1 ? str.substring(start, end + 1) : str
}

/**
 * Curried version of {@link removeSurrounding} with str first.
 * @category Transformation
 * @param str - The string to process
 * @returns Function that takes target and returns the processed string
 */
export const removeSurroundingOn = curry(removeSurrounding)

/**
 * Curried version of {@link removeSurrounding} with target first.
 * @category Transformation
 * @param target - The character to remove from both ends
 * @returns Function that takes str and returns the processed string
 */
export const removeSurroundingWith = flipCurried(removeSurroundingOn)

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • truncate
//
//

/**
 * Truncate a string to a maximum length, adding ellipsis if truncated.
 * @category Transformation
 * @param str - The string to truncate
 * @param maxLength - Maximum length of the result (default: 80)
 * @returns The truncated string with ellipsis if needed
 * @example
 * ```typescript
 * truncate('hello world', 8) // 'hello...'
 * truncate('short', 10) // 'short'
 * truncate('very long text that needs truncating') // 'very long text that needs truncating...' (if > 80 chars)
 * ```
 */
export const truncate = (str: string, maxLength: number = 80): string => {
  if (str.length <= maxLength) return str
  const indicator = '...'
  // No negative slice size
  const sliceSize = Math.max(maxLength - indicator.length, 0)
  return `${str.slice(0, sliceSize)}${indicator}`
}

/**
 * Curried version of {@link truncate} with str first.
 * @category Transformation
 * @param str - The string to truncate
 * @returns Function that takes maxLength and returns the truncated string
 */
export const truncateOn = curry(truncate)

/**
 * Curried version of {@link truncate} with maxLength first.
 * @category Transformation
 * @param maxLength - Maximum length of the result
 * @returns Function that takes str and returns the truncated string
 * @example
 * ```typescript
 * const truncate10 = truncateWith(10)
 * truncate10('hello world') // 'hello w...'
 * ```
 */
export const truncateWith = flipCurried(truncateOn)

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Unorized
//
//

/**
 * Remove all occurrences of patterns from a string.
 * @category Transformation
 * @param pattern - String or RegExp pattern(s) to remove
 * @returns Function that takes a value and returns the stripped string
 * @example
 * ```typescript
 * const removeVowels = strip(/[aeiou]/g)
 * removeVowels('hello world') // 'hll wrld'
 * ```
 */
export const strip = (pattern: string | string[] | RegExp) => replaceWith(pattern, Empty)

/**
 * Remove regular spaces from the beginning and end of a string.
 * Pre-configured {@link removeSurroundingWith} for regular spaces.
 * @category Transformation
 * @param str - The string to process
 * @returns The string with surrounding spaces removed
 */
export const removeSurroundingSpaceRegular = removeSurroundingWith(Char.spaceRegular)

/**
 * Remove non-breaking spaces from the beginning and end of a string.
 * Pre-configured {@link removeSurroundingWith} for non-breaking spaces.
 * @category Transformation
 * @param str - The string to process
 * @returns The string with surrounding non-breaking spaces removed
 */
export const removeSurroundingSpaceNoBreak = removeSurroundingWith(Char.spaceNoBreak)

import { Arr } from '#arr'
import { CoreFn as Fn } from '#fn/core'
import { Ts } from '#ts'
import { type Regex, regex, type regex as regexTypes } from 'arkregex'
import type {
  Flags,
  IndexedCaptures as PositionalCaptures,
  NamedCaptures,
  RegexContext,
} from 'arkregex/internal/regex.js'
import { Option } from 'effect'

// ============================================================================
// Types
// ============================================================================

export type { Flags, NamedCaptures, PositionalCaptures, Regex, RegexContext }

export type PatternInput = string | RegExp | Regex

/**
 * Result of matching a regex pattern against a string.
 *
 * Used as both the return type of {@link match} and the callback parameter
 * for {@link replace} and {@link replaceAll}.
 *
 * @example
 * ```typescript
 * // Pattern: /(\w+)@(\w+)/g on "foo@bar baz@qux"
 * // Each match produces:
 * // { value: "foo@bar", captures: ["foo", "bar"], offset: 0, ... }
 * // { value: "baz@qux", captures: ["baz", "qux"], offset: 8, ... }
 * ```
 *
 * @category Pattern Matching
 */
export type RegexMatch<$Regex extends Regex = Regex> = {
  /** The entire matched substring. Typed from the pattern (e.g., `` `${bigint}` `` for `\d+`). */
  value: $Regex['infer']
  /** Zero-based index where this match starts in the input. */
  offset: number
  /** Positional capture groups as a typed tuple. */
  captures: $Regex['inferCaptures']
  /** Named capture groups as a typed object. */
  groups: $Regex['inferNamedCaptures']
  /** The original input string. */
  input: string
}

// ============================================================================
// Pattern Construction
// ============================================================================

/**
 * Create a typed pattern from a regular expression with automatic type inference.
 * Uses ArkRegex to parse the pattern and infer capture group types at compile time.
 *
 * @category Pattern Matching
 * @param src - The regular expression pattern string
 * @param flags - Optional regex flags (g, i, m, s, u, v, y, d)
 * @returns A typed Regex with inferred capture groups
 *
 * @example
 * ```typescript
 * // Automatic type inference from pattern
 * const emailPattern = pattern("(?<name>\\w+)@(?<domain>\\w+)")
 * // Type: Regex<..., { names: { name: string, domain: string } }>
 *
 * const result = match('user@example.com', emailPattern)
 * if (Option.isSome(result)) {
 *   console.log(result.value.groups.name)    // 'user' (typed!)
 *   console.log(result.value.groups.domain)  // 'example.com' (typed!)
 * }
 * ```
 */
export const pattern: PatternFunction = ((src: any, flags?: any) => {
  return regex(src, flags)
}) as any

interface PatternFunction {
  <$src extends string, $flags extends Flags = ''>(
    src: $src,
    flags?: $flags,
  ): regexTypes.parse<$src, $flags>

  /**
   * Create a typed pattern with manual type assertions.
   * Use this as an escape hatch when automatic inference doesn't work or for pre-existing RegExp objects.
   *
   * @example
   * ```typescript
   * // Manual typing for string patterns
   * const complex = pattern.as<string, { names: { id: string } }>("...")
   *
   * // Manual typing for RegExp literals from libraries
   * const external: RegExp = someLibrary.getPattern()
   * const typed = pattern.as<string, { names: { user: string } }>(external)
   * ```
   */
  as: {
    <$pattern extends string = string, $ctx extends RegexContext = {}>(
      src: string,
      flags?: Flags,
    ): Regex<$pattern, $ctx>
    <$pattern extends string = string, $ctx extends RegexContext = {}>(
      regexp: RegExp,
    ): Regex<$pattern, $ctx>
  }
} // Implement .as() method

;(pattern as PatternFunction).as = ((srcOrRegexp: string | RegExp, flags?: Flags): Regex => {
  if (typeof srcOrRegexp === 'string') {
    return regex.as(srcOrRegexp, flags) as any
  }
  // For RegExp input, cast to Regex with manual type assertion
  return srcOrRegexp as any
}) as any

/**
 * Curried version of {@link pattern} with flags first.
 *
 * @category Pattern Matching
 * @param flags - Regex flags (g, i, m, s, u, v, y, d)
 * @returns Function that takes a pattern string and returns a typed Regex
 *
 * @example
 * ```typescript
 * const globalPattern = patternWith('g')
 * const numbers = globalPattern('\\d+')
 * matchAll('a1 b2 c3', numbers) // Works with global pattern
 * ```
 */
export const patternWith =
  <$flags extends Flags>(flags: $flags) =>
  <$src extends string>(src: $src): Regex<$src, { flags: $flags }> => {
    return pattern(src, flags) as any
  }

// ============================================================================
// Match Functions
// ============================================================================

/**
 * Match a string against a pattern with type-safe results.
 *
 * @category Pattern Matching
 * @param string - The string to match against
 * @param pattern - String (exact match), RegExp, or typed Regex pattern
 * @returns Option of match result with typed capture groups, or None if no match
 *
 * @example
 * ```typescript
 * // With typed pattern
 * const p = pattern("(?<name>\\w+) is (?<age>\\d+)")
 * const result = match('John is 25', p)
 * if (Option.isSome(result)) {
 *   console.log(result.value.groups.name) // 'John' (typed)
 *   console.log(result.value.groups.age)  // '25' (typed)
 * }
 *
 * // With plain RegExp (untyped)
 * const result2 = match('hello world', /hello (\w+)/)
 * if (Option.isSome(result2)) {
 *   console.log(result2.value[1]) // 'world'
 * }
 *
 * // With string (exact match)
 * const result3 = match('hello', 'hello')
 * if (Option.isSome(result3)) {
 *   console.log(result3.value[0]) // 'hello'
 * }
 * ```
 */
export const match = <$pattern extends string = string, $ctx extends RegexContext = RegexContext>(
  string: string,
  pattern: string | RegExp | Regex<$pattern, $ctx>,
): Option.Option<RegexMatch<Regex<$pattern, $ctx>>> => {
  if (typeof pattern === 'string') {
    // String pattern = exact match
    if (string !== pattern) return Option.none()
    return Option.some({
      value: string,
      offset: 0,
      captures: [],
      groups: {},
      input: string,
    } as any)
  }

  const result = string.match(pattern)
  if (!result) return Option.none()

  // Convert native RegExpMatchArray to RegexMatch
  const captures = result.slice(1) // Positional captures start at [1]
  return Option.some({
    value: result[0],
    offset: result.index ?? 0,
    captures,
    groups: result.groups ?? {},
    input: result.input ?? string,
  } as any)
}

/**
 * Curried version of {@link match} with string first.
 *
 * @category Pattern Matching
 */
export const matchOn = Fn.curry(match)

/**
 * Curried version of {@link match} with pattern first.
 *
 * @category Pattern Matching
 */
export const matchWith = Fn.flipCurried(matchOn)

// ============================================================================
// Match All
// ============================================================================

/**
 * Type-level guard that ensures a Regex has the global flag.
 * Returns a static error if the flag is missing.
 */
// oxfmt-ignore
export type GuardGlobalFlag<$R extends Regex> =
  $R['flags'] extends `${string}g${string}`
    ? $R
    : Ts.Err.StaticError<'regex-missing-global-flag', { flags: $R['flags'] }>

/**
 * Match all occurrences of a pattern in a string.
 * Requires a pattern with the global flag - enforced at type level.
 *
 * @category Pattern Matching
 * @param string - The string to search in
 * @param pattern - A Regex pattern with the global flag
 * @returns Iterable of match results with typed capture groups
 *
 * @example
 * ```typescript
 * const p = pattern("(?<letter>\\w)(?<digit>\\d)", "g")
 * const matches = matchAll("a1 b2 c3", p)
 *
 * for (const m of matches) {
 *   console.log(m.groups.letter) // 'a', 'b', 'c' (typed)
 *   console.log(m.groups.digit)  // '1', '2', '3' (typed)
 * }
 *
 * // Non-global pattern causes compile error:
 * const nonGlobal = pattern("\\d+")
 * matchAll("a1 b2", nonGlobal) // ❌ Type error: missing 'g' flag
 * ```
 */
export const matchAll = <
  $pattern extends string = string,
  $ctx extends RegexContext = RegexContext,
>(
  string: string,
  pattern: GuardGlobalFlag<Regex<$pattern, $ctx>>,
): IterableIterator<RegExpExecArray> => {
  return string.matchAll(pattern as RegExp)
}

/**
 * Curried version of {@link matchAll} with string first.
 *
 * @category Pattern Matching
 */
export const matchAllOn = Fn.curry(matchAll)

/**
 * Curried version of {@link matchAll} with pattern first.
 *
 * @category Pattern Matching
 */
export const matchAllWith = Fn.flipCurried(matchAllOn)

// ============================================================================
// Predicates
// ============================================================================

/**
 * Check if a string matches a pattern.
 *
 * @category Predicates
 * @param value - The string to test
 * @param pattern - String for exact match, RegExp, or typed Regex pattern
 * @returns True if the value matches the pattern
 *
 * @example
 * ```typescript
 * isMatch('hello', 'hello')           // true (exact)
 * isMatch('hello', /^h.*o$/)          // true (regex)
 * isMatch('hello', pattern('^h.*o$')) // true (typed)
 * isMatch('world', 'hello')           // false
 * ```
 */
export const isMatch = (value: string, pattern: PatternInput): boolean => {
  if (typeof pattern === `string`) {
    return value === pattern
  }
  return pattern.test(value)
}

/**
 * Curried version of {@link isMatch} with value first.
 *
 * @category Predicates
 */
export const isMatchOn = Fn.curry(isMatch)

/**
 * Curried version of {@link isMatch} with pattern first.
 *
 * @category Predicates
 */
export const isMatchWith = Fn.flipCurried(isMatchOn)

/**
 * Check if a string does not match a pattern.
 *
 * @category Predicates
 */
export const isntMatch =
  (pattern: PatternInput) =>
  (value: string): boolean => {
    return !isMatch(value, pattern)
  }

/**
 * Curried version of {@link isntMatch} with value first.
 *
 * @category Predicates
 */
export const isntMatchOn = Fn.curry(isntMatch)

/**
 * Curried version of {@link isntMatch} with pattern first.
 *
 * @category Predicates
 */
export const isntMatchWith = Fn.flipCurried(isntMatchOn)

// ============================================================================
// Multiple Pattern Predicates
// ============================================================================

export type PatternsInput = Arr.Maybe<PatternInput>

/**
 * Check if a string matches any of the provided patterns.
 *
 * @category Predicates
 * @param value - The string to test
 * @param patterns - Array of strings, RegExp, or Regex patterns (or a single pattern)
 * @returns True if the value matches any pattern
 *
 * @example
 * ```typescript
 * isMatchAny('hello', ['hello', 'world'])              // true
 * isMatchAny('hello', [/^h/, /o$/])                    // true
 * isMatchAny('hello', [pattern('^h'), pattern('o$')])  // true
 * isMatchAny('foo', ['hello', 'world'])                // false
 * ```
 */
export const isMatchAny = (value: string, patterns: PatternsInput): boolean => {
  const patterns_ = Arr.sure(patterns)
  return patterns_.some(isMatchOn(value))
}

/**
 * Curried version of {@link isMatchAny} with value first.
 *
 * @category Predicates
 */
export const isMatchAnyOn = Fn.curry(isMatchAny)

/**
 * Curried version of {@link isMatchAny} with patterns first.
 *
 * @category Predicates
 */
export const isMatchAnyWith = Fn.flipCurried(isMatchAnyOn)

/**
 * Check if a string does not match any of the provided patterns.
 *
 * @category Predicates
 */
export const isNotMatchAny =
  (patternOrPatterns: PatternsInput) =>
  (value: string): boolean => {
    return !isMatchAny(value, patternOrPatterns)
  }

/**
 * Curried version of {@link isNotMatchAny} with value first.
 *
 * @category Predicates
 */
export const isNotMatchAnyOn = Fn.curry(isNotMatchAny)

/**
 * Curried version of {@link isNotMatchAny} with patterns first.
 *
 * @category Predicates
 */
export const isNotMatchAnyWith = Fn.flipCurried(isNotMatchAnyOn)

/**
 * Display handler for RegExp type.
 * @internal
 */
declare global {
  namespace KITZ.Traits.Display {
    interface Handlers<$Type> {
      _regExp: $Type extends RegExp ? 'RegExp' : never
    }
  }
}

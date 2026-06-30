/**
 * Type-level string utilities.
 *
 * Provides compile-time string manipulation and analysis types.
 */

import type { Ts } from '#ts'
import type { Length } from './length.js'

/**
 * Determine if a string type is a literal or the generic `string` type.
 *
 * Returns `'literal'` for concrete string literals, `'string'` for the `string` type.
 * Template literals with string interpolations will be detected by the consuming utilities
 * during their normal computation and will return `number`.
 *
 * Useful for discriminated type branching with indexed access patterns.
 *
 * @category Type-Level Utilities
 *
 * @example
 * ```ts
 * // Discriminated branching pattern
 * type Result<$S extends string> = {
 *   string: number
 *   literal: ComputeExactValue<$S>
 * }[Str.GetKindCase<$S>]
 *
 * type R1 = Result<'hello'>              // ComputeExactValue<'hello'>
 * type R2 = Result<string>               // number
 * type R3 = Result<`prefix-${string}`>   // number (detected during computation)
 * ```
 */
export type GetKindCase<$S extends string> = string extends $S ? 'string' : 'literal'

/**
 * Check if a string ends with a specific suffix.
 * @category Type-Level Utilities
 */
export type EndsWith<S extends string, T extends string> = S extends `${string}${T}` ? true : false

/**
 * Check if a string starts with a specific prefix.
 * @category Type-Level Utilities
 */
export type StartsWith<S extends string, T extends string> = S extends `${T}${string}`
  ? true
  : false

/**
 * Extract the last segment from a path-like string (after the last '/').
 * @category Type-Level Utilities
 */
export type LastSegment<S extends string> = S extends `${string}/${infer Rest}`
  ? LastSegment<Rest>
  : S

/**
 * Remove trailing slash from a string.
 * @category Type-Level Utilities
 */
export type RemoveTrailingSlash<S extends string> = S extends `${infer Rest}/`
  ? Rest extends ''
    ? '/'
    : Rest
  : S

/**
 * Split a string by a delimiter, filtering out empty segments and '.' segments.
 * This is useful for path-like strings.
 * @category Type-Level Utilities
 */
export type Split<S extends string, D extends string, Acc extends string[] = []> = S extends ''
  ? Acc
  : S extends `${infer Segment}${D}${infer Rest}`
    ? Segment extends ''
      ? Split<Rest, D, Acc>
      : Segment extends '.'
        ? Split<Rest, D, Acc>
        : Split<Rest, D, [...Acc, Segment]>
    : S extends '.'
      ? Acc
      : [...Acc, S]

/**
 * Check if string contains a character.
 * @category Type-Level Utilities
 */
export type Contains<S extends string, C extends string> = S extends `${string}${C}${string}`
  ? true
  : false

/**
 * Error for when a string literal is required but a general string type was provided.
 */
export interface ErrorNotLiteral<T, $ErrorMessage extends string> extends Ts.Err.StaticError<
  ['str', 'not-literal'],
  {
    message: $ErrorMessage
    ReceivedType: T
    tip: 'Use a string literal instead of string type'
  }
> {}

/**
 * Constraint that only accepts literal strings.
 * Returns StaticError for non-literal string type with customizable error message.
 * @category Type-Level Utilities
 * @template T - The string type to check
 * @template $ErrorMessage - Custom error message to display when T is not a literal
 */
export type LiteralOnly<
  T extends string,
  $ErrorMessage extends string = 'Expected a literal string',
> = string extends T ? ErrorNotLiteral<T, $ErrorMessage> : T

/**
 * Pad a string to a target length by appending a fill character.
 *
 * If the string is already at or exceeds the target length, returns it unchanged.
 * Limited by TypeScript's recursion depth (~50 iterations).
 *
 * @category Type-Level Utilities
 * @template $S - The string to pad
 * @template $TargetLen - The desired final length
 * @template $Fill - The character to use for padding (default: '_')
 * @template $Acc - Accumulator for recursion depth tracking (internal)
 *
 * @example
 * ```ts
 * type P1 = Str.PadEnd<'foo', 10, '_'> // 'foo_______'
 * type P2 = Str.PadEnd<'hello', 3, '_'> // 'hello' (already longer)
 * type P3 = Str.PadEnd<'abc', 5, '0'> // 'abc00'
 * ```
 */
// oxfmt-ignore
export type PadEnd<
  $S extends string,
  $TargetLen extends number,
  $Fill extends string = '_',
  $Acc extends 0[] = [],
> = Length<$S> extends $TargetLen ? $S
  : $Acc['length'] extends 50 // Recursion limit safety
    ? $S
    : PadEnd<`${$S}${$Fill}`, $TargetLen, $Fill, [...$Acc, 0]>

/**
 * Pad a string to a target length by prepending a fill character.
 *
 * If the string is already at or exceeds the target length, returns it unchanged.
 * Limited by TypeScript's recursion depth (~50 iterations).
 *
 * @category Type-Level Utilities
 * @template $S - The string to pad
 * @template $TargetLen - The desired final length
 * @template $Fill - The character to use for padding (default: '0')
 * @template $Acc - Accumulator for recursion depth tracking (internal)
 *
 * @example
 * ```ts
 * type P1 = Str.PadStart<'42', 5, '0'> // '00042'
 * type P2 = Str.PadStart<'hello', 3, '0'> // 'hello' (already longer)
 * type P3 = Str.PadStart<'x', 3, ' '> // '  x'
 * ```
 */
// oxfmt-ignore
export type PadStart<
  $S extends string,
  $TargetLen extends number,
  $Fill extends string = '0',
  $Acc extends 0[] = [],
> = Length<$S> extends $TargetLen ? $S
  : $Acc['length'] extends 50 // Recursion limit safety
    ? $S
    : PadStart<`${$Fill}${$S}`, $TargetLen, $Fill, [...$Acc, 0]>

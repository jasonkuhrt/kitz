/**
 * String length utilities - both type-level and runtime.
 *
 * Provides compile-time string length calculation with performance optimizations
 * and a runtime function with type-level literal inference.
 */

import type { Ts } from '#ts'
import type { GetKindCase } from './type-level.js'

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Type-Level Implementation
//
//
//
//

/**
 * Error for when string length exceeds the fast path limit and slow mode is not enabled.
 */
export interface ErrorLengthExceedsLimit<$S extends string> extends Ts.Err.StaticError<
  ['str', 'length', 'exceeds-limit'],
  {
    message: 'String length exceeds fast path limit (20 chars)'
    hint: 'Pass true as second parameter or set KITZ.Perf.Settings.allowSlow to true'
    limit: '0-20 chars (fast) | 21-4000 chars (slow, opt-in)'
    received: $S
  }
> {}

/**
 * Fast path for string length (0-20 characters).
 * Uses nested pattern matching for exact length detection.
 * Detects template literals with string interpolations and returns `number`.
 *
 * @internal
 * @template $S - The string to measure
 * @returns The length (0-20), `number` for template literals, or `never` if string exceeds 20 characters
 */
// oxfmt-ignore
type LengthFast<$S extends string> =
  $S extends ''                           ? 0 :
  $S extends `${infer _1}${infer __r1__}` ? (
    string extends __r1__                       ? number :
    __r1__ extends ''                           ? 1 :
    __r1__ extends `${infer _2}${infer __r2__}` ? (
      string extends __r2__                        ? number :
      __r2__ extends ''                           ? 2 :
      __r2__ extends `${infer _3}${infer __r3__}` ? (
        string extends __r3__                        ? number :
        __r3__ extends ''                           ? 3 :
        __r3__ extends `${infer _4}${infer __r4__}` ? (
          string extends __r4__                        ? number :
          __r4__ extends ''                           ? 4 :
          __r4__ extends `${infer _5}${infer __r5__}` ? (
            string extends __r5__                        ? number :
            __r5__ extends ''                           ? 5 :
            __r5__ extends `${infer _6}${infer __r6__}` ? (
              string extends __r6__                        ? number :
              __r6__ extends ''                           ? 6 :
              __r6__ extends `${infer _7}${infer __r7__}` ? (
                string extends __r7__                        ? number :
                __r7__ extends ''                           ? 7 :
                __r7__ extends `${infer _8}${infer __r8__}` ? (
                  string extends __r8__                        ? number :
                  __r8__ extends ''                           ? 8 :
                  __r8__ extends `${infer _9}${infer __r9__}` ? (
                    string extends __r9__                         ? number :
                    __r9__ extends ''                            ? 9 :
                    __r9__ extends `${infer _10}${infer __r10__}` ? (
                      string extends __r10__                        ? number :
                      __r10__ extends ''                            ? 10 :
                      __r10__ extends `${infer _11}${infer __r11__}` ? (
                        string extends __r11__                        ? number :
                        __r11__ extends ''                            ? 11 :
                        __r11__ extends `${infer _12}${infer __r12__}` ? (
                          string extends __r12__                        ? number :
                          __r12__ extends ''                            ? 12 :
                          __r12__ extends `${infer _13}${infer __r13__}` ? (
                            string extends __r13__                        ? number :
                            __r13__ extends ''                            ? 13 :
                            __r13__ extends `${infer _14}${infer __r14__}` ? (
                              string extends __r14__                        ? number :
                              __r14__ extends ''                            ? 14 :
                              __r14__ extends `${infer _15}${infer __r15__}` ? (
                                string extends __r15__                        ? number :
                                __r15__ extends ''                            ? 15 :
                                __r15__ extends `${infer _16}${infer __r16__}` ? (
                                  string extends __r16__                        ? number :
                                  __r16__ extends ''                            ? 16 :
                                  __r16__ extends `${infer _17}${infer __r17__}` ? (
                                    string extends __r17__                        ? number :
                                    __r17__ extends ''                            ? 17 :
                                    __r17__ extends `${infer _18}${infer __r18__}` ? (
                                      string extends __r18__                        ? number :
                                      __r18__ extends ''                            ? 18 :
                                      __r18__ extends `${infer _19}${infer __r19__}` ? (
                                        string extends __r19__                        ? number :
                                        __r19__ extends ''                            ? 19 :
                                        __r19__ extends `${infer _20}${infer __r20__}` ? (
                                          string extends __r20__                        ? number :
                                          __r20__ extends '' ? 20 : never
                                        ) : never
                                      ) : never
                                    ) : never
                                  ) : never
                                ) : never
                              ) : never
                            ) : never
                          ) : never
                        ) : never
                      ) : never
                    ) : never
                  ) : never
                ) : never
              ) : never
            ) : never
          ) : never
        ) : never
      ) : never
    ) : never
  ) : never

/**
 * Normalize allowSlow setting - converts unaugmented `boolean` type to literal `false`.
 * @internal
 */
type NormalizeAllowSlow<$Value> = boolean extends $Value ? false : $Value

/**
 * Slow path for string length (21+ characters).
 * Uses tail-recursive algorithm with 4x unrolling - up to ~4000 characters.
 * Detects template literals with string interpolations and returns `number`.
 *
 * @internal
 * @template $S - The string to measure
 * @template $Acc - Accumulator tuple for counting (internal, powers of 4)
 * @returns The computed length or `number` for template literals
 */
// oxfmt-ignore
type LengthSlow<$S extends string, $Acc extends 0[] = []> =
  $S extends `${string}${string}${string}${string}${infer __r__}`
    ? string extends __r__
      ? number
      : LengthSlow<__r__, [...$Acc, 0, 0, 0, 0]> :
  $S extends `${string}${string}${string}${infer __r__}`
    ? string extends __r__
      ? number
      : [...$Acc, 0, 0, 0]['length'] :
  $S extends `${string}${string}${infer __r__}`
    ? string extends __r__
      ? number
      : [...$Acc, 0, 0]['length'] :
  $S extends `${string}${infer __r__}`
    ? string extends __r__
      ? number
      : [...$Acc, 0]['length'] :
  $Acc['length']

/**
 * Get the length of a string literal type.
 *
 * For non-literal strings (type `string`), returns `number`.
 * For literal strings, returns exact length or error based on settings.
 *
 * **Performance characteristics:**
 * - **0-20 chars**: Instant evaluation via pattern matching lookup table (6-362 instantiations)
 * - **21-4000 chars**: Requires {@link KITZ.Perf.Settings.allowSlow} flag or local override
 *   - When enabled: Uses tail-recursive 4x unrolling (597-2053 instantiations)
 *   - Limit: ~4000 chars (1000 tail recursion limit × 4 chars/recursion)
 *   - When disabled: Returns helpful error with instructions to enable
 * - **4000+ chars**: Exceeds TypeScript's tail recursion depth limit, will fail
 * - **Non-literal (`string`)**: Returns `number` (cannot determine length at compile time)
 *
 * **Implementation details:**
 * The 4000 character limit is specific to this utility's 4x unrolling strategy.
 * Other utilities may have different limits based on their unrolling factor and
 * type complexity. Fast path covers 95% of real-world use cases with zero performance cost.
 *
 * @category Type-Level Utilities
 * @template $S - The string to measure
 * @template $AllowSlow - Local override for allowSlow setting (defaults to global setting)
 *
 * @example
 * ```ts
 * // Fast path (instant)
 * type L1 = Str.Length<'hello'> // 5
 * type L2 = Str.Length<''> // 0
 * type L3 = Str.Length<'a'> // 1
 *
 * // Non-literal string
 * type L4 = Str.Length<string> // number
 *
 * // Exceeds fast path without flag
 * type L5 = Str.Length<'this string is over 20 chars long'>
 * // Error: String length exceeds fast path limit (20 chars)
 * //        Set KITZ.Perf.Settings.allowSlow to true
 *
 * // Local override - no global setting needed
 * type L6 = Str.Length<'this string is over 20 chars long', true> // 38 (works, slower compilation)
 *
 * // With global allowSlow flag enabled
 * declare global {
 *   namespace KITZ {
 *     namespace Perf {
 *       interface Settings {
 *         allowSlow: true
 *       }
 *     }
 *   }
 * }
 * type L7 = Str.Length<'this string is over 20 chars long'> // 38 (works, slower compilation)
 * ```
 */
// oxfmt-ignore
export type Length<
  $S extends string,
  $AllowSlow extends boolean = KITZ.Perf.Settings['allowSlow']
> = {
  string: number
  literal: LengthFast<$S> extends never
    ? NormalizeAllowSlow<$AllowSlow> extends true
      ? LengthSlow<$S>
      : ErrorLengthExceedsLimit<$S>
    : LengthFast<$S>
}[GetKindCase<$S>]

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Runtime Implementation
//
//
//
//

/**
 * Get the length of a string.
 *
 * Runtime function with type-level literal inference. For literal strings,
 * the return type is the exact length. For non-literal strings, returns `number`.
 *
 * @category Runtime Utilities
 * @template $S - The string to measure
 *
 * @example
 * ```ts
 * const len1 = Str.length('hello')  // Type: 5, Runtime: 5
 * const len2 = Str.length('')       // Type: 0, Runtime: 0
 *
 * declare const s: string
 * const len3 = Str.length(s)        // Type: number, Runtime: s.length
 * ```
 */
export const length = <$S extends string>(s: $S): Length<$S> => {
  return s.length as any
}

/**
 * Type-level string operators that effect's (value-level) `String` module does
 * not provide. Re-exported from the `String` namespace alongside effect's own
 * `String`, so consumers get both under one import.
 */

/** Check if a string ends with a specific suffix. */
export type EndsWith<$S extends string, $T extends string> = string extends $S | $T
  ? boolean
  : $S extends `${string}${$T}`
    ? true
    : false

/** Check if a string starts with a specific prefix. */
export type StartsWith<$S extends string, $T extends string> = string extends $S | $T
  ? boolean
  : $S extends `${$T}${string}`
    ? true
    : false

type AfterLastScan<$S extends string, $D extends string, $Best extends string> = $S extends ''
  ? $Best
  : $S extends `${infer $Character}${infer $Rest}`
    ? AfterLastScan<$Rest, $D, $S extends `${$D}${infer $AfterDelimiter}` ? $AfterDelimiter : $Best>
    : $Best

/** The substring after the last occurrence of a delimiter. */
export type AfterLast<$S extends string, $D extends string> = string extends $S | $D
  ? string
  : $D extends ''
    ? ''
    : AfterLastScan<$S, $D, $S>

/** Recursively remove every trailing occurrence of a suffix. */
export type RemoveTrailing<$S extends string, $Suffix extends string> = string extends $S | $Suffix
  ? string
  : $Suffix extends ''
    ? $S
    : $S extends `${infer $Rest}${$Suffix}`
      ? RemoveTrailing<$Rest, $Suffix>
      : $S

type SplitCharacters<$S extends string, $Acc extends string[] = []> = $S extends ''
  ? $Acc
  : $S extends `${infer $Character}${infer $Rest}`
    ? SplitCharacters<$Rest, [...$Acc, $Character]>
    : $Acc

type SplitByDelimiter<
  $S extends string,
  $D extends string,
  $Acc extends string[] = [],
> = $S extends `${infer $Segment}${$D}${infer $Rest}`
  ? SplitByDelimiter<$Rest, $D, [...$Acc, $Segment]>
  : [...$Acc, $S]

type Take<
  $Tuple extends string[],
  $Limit extends number | undefined,
  $Acc extends string[] = [],
> = $Limit extends undefined
  ? $Tuple
  : number extends $Limit
    ? string[]
    : $Acc['length'] extends $Limit
      ? $Acc
      : $Tuple extends [infer $Head extends string, ...infer $Tail extends string[]]
        ? Take<$Tail, $Limit, [...$Acc, $Head]>
        : $Acc

/**
 * A pure delimiter split matching `String.prototype.split`, except that an
 * empty delimiter splits astral characters by TypeScript's template-literal
 * code-point inference. Generic UTF-16 code-unit parity is not expressible at
 * the type level.
 *
 * Caveat, concretely: `Split<'🚀', ''>` is `['🚀']` (one code point) while
 * `'🚀'.split('')` is `['\ud83d', '\ude80']` (two code units) at runtime.
 * BMP inputs, non-empty delimiters, and `limit` have exact JS parity.
 */
export type Split<
  $S extends string,
  $D extends string,
  $Limit extends number | undefined = undefined,
> = $Limit extends 0
  ? []
  : string extends $S | $D
    ? string[]
    : Take<$D extends '' ? SplitCharacters<$S> : SplitByDelimiter<$S, $D>, $Limit>

/**
 * Type-level string operators that effect's (value-level) `String` module does
 * not provide. Re-exported from the `String` namespace alongside effect's own
 * `String`, so consumers get both under one import.
 */

/** Check if a string ends with a specific suffix. */
export type EndsWith<$S extends string, $T extends string> = $S extends `${string}${$T}`
  ? true
  : false

/** Check if a string starts with a specific prefix. */
export type StartsWith<$S extends string, $T extends string> = $S extends `${$T}${string}`
  ? true
  : false

/** The substring after the last occurrence of a delimiter. */
export type AfterLast<$S extends string, $D extends string> = string extends $S | $D
  ? string
  : $D extends ''
    ? ''
    : $S extends `${string}${$D}${infer $Rest}`
      ? AfterLast<$Rest, $D>
      : $S

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

/** A pure delimiter split matching `String.prototype.split`. */
export type Split<$S extends string, $D extends string> = string extends $S | $D
  ? string[]
  : $D extends ''
    ? SplitCharacters<$S>
    : SplitByDelimiter<$S, $D>

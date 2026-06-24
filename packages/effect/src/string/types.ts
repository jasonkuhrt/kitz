/**
 * Type-level string operators that effect's (value-level) `String` module does
 * not provide. Re-exported from the `String` namespace alongside effect's own
 * `String`, so consumers get both under one import.
 */

/** Check if a string ends with a specific suffix. */
export type EndsWith<S extends string, T extends string> = S extends `${string}${T}` ? true : false

/** Check if a string starts with a specific prefix. */
export type StartsWith<S extends string, T extends string> = S extends `${T}${string}`
  ? true
  : false

/** Extract the last segment from a path-like string (after the last '/'). */
export type LastSegment<S extends string> = S extends `${string}/${infer Rest}`
  ? LastSegment<Rest>
  : S

/** Remove all trailing slashes from a string (a lone '/' is preserved). */
export type RemoveTrailingSlash<S extends string> = S extends `${infer Rest}/`
  ? Rest extends ''
    ? '/'
    : RemoveTrailingSlash<Rest>
  : S

/** Split a string by a delimiter, filtering out empty segments and '.' segments. */
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

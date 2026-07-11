type IsUnion<$Value, $Whole = $Value> = $Value extends unknown
  ? [$Whole] extends [$Value]
    ? false
    : true
  : never

type IsFiniteString<$S extends string> = $S extends ''
  ? true
  : $S extends `${infer $Head}${infer $Tail}`
    ? $Head extends ''
      ? false
      : string extends $Head
        ? false
        : IsFiniteString<$Tail>
    : false

/**
 * Whether a string type denotes exactly one fully known string value.
 * Dynamic strings, open template/intrinsic patterns, and finite unions return
 * `false`; literal constructors can therefore promise one statically knowable
 * runtime input.
 */
export type IsLiteral<$S extends string> = [$S] extends [never]
  ? false
  : string extends $S
    ? false
    : IsUnion<$S> extends true
      ? false
      : IsFiniteString<$S>

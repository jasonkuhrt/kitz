import { Schema as S } from 'effect'
import type { FromTargetLiteral, LiteralGuard } from './literal.js'

// Path schemas compose Schema's `withStatics` with the literal constructor below.
// Equality is intentionally not attached: `Schema.toEquivalence` mis-derives over
// path unions, so comparison goes through structural `Equal.equals` instead.
/** Literal-aware `make` overloads attached to path schemas. */
type LiteralAwareMake<$Self extends S.Top> = {
  // TypeScript reports the last failed overload, so the literal guard must be
  // declared last for malformed strings to render its branded message inline.
  /** Preserve the schema's original Type-side constructor input and options. */
  (input: $Self['~type.make.in'], options?: S.MakeOptions): $Self['Type']
  /** Decode a string literal as this path schema, rejecting target mismatches statically. */
  <const $Input extends string>(
    input: LiteralGuard<$Input, $Self['Type']>,
  ): FromTargetLiteral<$Input, $Self['Type']>
}

type LiteralMakeStatic<$Self extends S.Top> = {
  readonly make: LiteralAwareMake<$Self>
}

/**
 * Replace a path schema's `make` with literal-aware overloads while preserving
 * its original Type-side constructor input.
 *
 * Use this only on leaf and pairwise path schemas; `Path.make` owns the
 * top-level `Any` union decode.
 */
export const withLiteralStatics = <$Self extends S.Top>(
  self: $Self,
): $Self & LiteralMakeStatic<$Self> => {
  const originalMake = self.make.bind(self)
  const make = (input: unknown, options?: S.MakeOptions): $Self['Type'] =>
    typeof input === 'string'
      ? S.decodeSync(self as any)(input)
      : originalMake(input as any, options)

  return Object.assign(self, { make }) as any
}

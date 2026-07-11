import { Schema as S } from 'effect'
import type { FromTargetLiteral, LiteralGuard } from './literal.js'

// Path schemas compose Schema's `withStatics` with the literal constructor below.
// Equality is intentionally not attached: `Schema.toEquivalence` mis-derives over
// path unions, so comparison goes through structural `Equal.equals` instead.
/** The target-validated literal constructor attached to path schemas. */
type LiteralConstructor<$Self extends S.Top> = {
  /** Decode a string literal as this path schema, rejecting target mismatches statically. */
  readonly mk: <const $Input extends string>(
    input: LiteralGuard<$Input, $Self['Type']>,
  ) => FromTargetLiteral<$Input, $Self['Type']>
}

/**
 * Attach the target-validated `mk` constructor to path schemas.
 *
 * Use this only on leaf and pairwise path schemas; `Path.mk` owns the top-level
 * `Any` union decode.
 */
export const withLiteralStatics = <$Self extends S.Top>(
  self: $Self,
): $Self & LiteralConstructor<$Self> =>
  Object.assign(self, {
    mk: (input: string): $Self['Type'] => S.decodeSync(self as any)(input),
  }) as any

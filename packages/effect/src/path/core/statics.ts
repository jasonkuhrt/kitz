import { Schema as S } from 'effect'
import type { FromTargetLiteral, LiteralGuard } from './literal.js'

/** The `is` guard {@link withStatics} attaches to every path schema. */
type Guard<$Self extends S.Top> = {
  /** Type guard for this schema's values. */
  readonly is: (u: unknown) => u is $Self['Type']
}

/**
 * Attach the `is` type guard to a schema so each model needn't declare it.
 *
 * Applied in the `extends` clause — `class X_ extends withStatics(S.asClass(…))` —
 * so the guard is inherited and `export class X_` stays a named, nameable
 * declaration (required for declaration emit; see the TS7056 note in CONTRIBUTING).
 *
 * Only `is` is attached: it derives correctly for both the leaf variants and the
 * unions (`S.is` handles unions). Equality is not attached — `Schema.toEquivalence`
 * mis-derives over the unions, so comparison goes through `Equal.equals`, which is
 * structural for these `Equal`-bearing values.
 */
export const withStatics = <$Self extends S.Top>(self: $Self): $Self & Guard<$Self> =>
  Object.assign(self, { is: S.is(self) }) as $Self & Guard<$Self>

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
    mk: (input: string): $Self['Type'] =>
      S.decodeSync(self as unknown as S.Decoder<$Self['Type']>)(input),
  }) as unknown as $Self & LiteralConstructor<$Self>

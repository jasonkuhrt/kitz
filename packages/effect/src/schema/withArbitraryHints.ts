import { Schema as S } from 'effect'

/**
 * Attaches arbitrary-derivation hints to a schema without changing what it
 * accepts — the result is a variant schema value: same set, different
 * generated distribution.
 *
 * **Details**
 *
 * The hints ride on an always-pass filter appended to the schema — effect's
 * general mechanism for enriching a node's derived capabilities. `candidate`
 * adds a weighted generation source while the schema's own generator stays at
 * weight 1, so hints bias generation but never replace it; `constraint`
 * refines the node's base generator (lengths, patterns, bounds). Candidate
 * output is still validated by every filter on the schema, so an invalid
 * candidate costs generation efficiency, never validity. Validation, JSON
 * Schema output, and `toArbitrary` report diagnostics are unaffected by the
 * carrier filter. At least one of `constraint` or `candidate` is required;
 * unchecked empty input returns the original schema without installing a
 * carrier filter.
 *
 * Because the variant is an ordinary schema value, the distribution composes:
 * embed it in a struct or array and `Schema.toArbitrary` of the container
 * picks up the bias — which loose fast-check arbitraries cannot do.
 *
 * Verified semantics (effect@4.0.0-beta.97): `docs/learnings/effect-arbitrary.md`.
 *
 * @example
 * ```ts
 * const NameRealistic = Name.pipe(
 *   Schema.withArbitraryHints({
 *     candidate: { weight: 20, make: (fc) => fc.stringMatching(/^[a-z]{1,8}$/) },
 *   }),
 * )
 * Schema.toArbitrary(NameRealistic) // ~20/21 realistic names, full space retained
 * ```
 */
export declare namespace withArbitraryHints {
  /** Options for biasing or constraining a schema's derived arbitrary. */
  export type Options = S.Annotations.ToArbitrary.Filter &
    (
      | {
          readonly constraint: NonNullable<S.Annotations.ToArbitrary.Filter['constraint']>
        }
      | {
          readonly candidate: NonNullable<S.Annotations.ToArbitrary.Filter['candidate']>
        }
    )
}

export const withArbitraryHints =
  (hints: withArbitraryHints.Options) =>
  <$Sch extends S.Top>(self: $Sch): $Sch['Rebuild'] =>
    hints.constraint === undefined && hints.candidate === undefined
      ? (self as any)
      : S.check<$Sch>(S.makeFilter<$Sch['Type']>(() => true, { arbitrary: hints }))(self)

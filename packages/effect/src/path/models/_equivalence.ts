import type { Equivalence } from 'effect'

/**
 * Build an equivalence for a tagged union by dispatching to each variant's own
 * equivalence.
 *
 * The union path schemas (`Abs`, `Rel`, `Dir`, `File`, `Path`) use this because
 * `Schema.toEquivalence` mis-derives over a union of the transform-based variant
 * schemas in effect@4.0.0-beta.85 (it returns a wrong `false` for equal values).
 * The per-variant `toEquivalence` is correct, so the union composes from those.
 */
export const unionEquivalence =
  <T extends { readonly _tag: string }>(
    byTag: Record<T['_tag'], Equivalence.Equivalence<any>>,
  ): Equivalence.Equivalence<T> =>
  (a, b) =>
    a._tag === b._tag ? byTag[a._tag as T['_tag']](a, b) : false

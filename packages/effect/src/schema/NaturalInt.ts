import { Schema as S } from 'effect'

/**
 * A natural number — a non-negative integer (`0, 1, 2, …`).
 *
 * Effect ships `Int` and the `isGreaterThanOrEqualTo` check but no ready-made
 * non-negative-integer schema, so `@kitz/effect` adds it under the `Schema` namespace.
 */
export const NaturalInt = S.Int.pipe(S.check(S.isGreaterThanOrEqualTo(0)))
export type NaturalInt = typeof NaturalInt.Type

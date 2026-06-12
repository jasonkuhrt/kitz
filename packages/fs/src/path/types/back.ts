import { Effect, Schema as S } from 'effect'

/**
 * Count of unresolved parent directory traversals (`..`) on relative paths.
 * Required in the Type, optional in the constructor (defaults to 0).
 */
export const Back = S.Int.pipe(
  S.check(S.isGreaterThanOrEqualTo(0)),
  S.withConstructorDefault(Effect.succeed(0)),
  S.annotate({
    identifier: 'Back',
    description: 'Count of unresolved parent directory traversals',
    // Generation-only bound: validation admits any non-negative integer, but
    // derived arbitraries must not produce values that explode
    // `'../'.repeat(back)` during encoding.
    toArbitrary: () => (fc) => fc.integer({ min: 0, max: 16 }),
  }),
)

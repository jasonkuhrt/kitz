import { test } from 'bun:test'
import { Effect, Scope } from 'effect'

/**
 * Run an Effect-returning test body via {@link Effect.runPromise}.
 *
 * Replacement for `@effect/vitest`'s `it.effect(...)`. The body returns an
 * Effect; this helper unwraps it so a Bun:test runner can `await` the
 * resolution.
 *
 * @example
 * ```ts
 * import { Test } from '@kitz/test'
 * import { Effect } from 'effect'
 *
 * Test.effect('does the thing', () =>
 *   Effect.gen(function* () {
 *     const value = yield* compute
 *     expect(value).toBe(42)
 *   }).pipe(Effect.provide(MyLayer)),
 * )
 * ```
 *
 * @category Effect Testing
 */
export const effect = (
  name: string,
  body: () => Effect.Effect<unknown, unknown, Scope.Scope>,
  timeout?: number,
): void => {
  test(
    name,
    async () => {
      await Effect.runPromise(Effect.scoped(body()))
    },
    timeout,
  )
}

/**
 * Run an Effect-returning test body in the live runtime via
 * {@link Effect.runPromise}.
 *
 * Replacement for `@effect/vitest`'s `it.live(...)`. Functionally equivalent
 * to {@link effect} since `Effect.runPromise` already uses the live runtime;
 * exported separately for parity with the prior call-site shape.
 *
 * @category Effect Testing
 */
export const live = (
  name: string,
  body: () => Effect.Effect<unknown, unknown, Scope.Scope>,
  timeout?: number,
): void => {
  test(
    name,
    async () => {
      await Effect.runPromise(Effect.scoped(body()))
    },
    timeout,
  )
}

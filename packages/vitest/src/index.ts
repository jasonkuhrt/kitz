/**
 * `@kitz/vitest` — internal, private Effect-native test layer over Vite+'s vitest.
 *
 * The runner is imported exclusively from `vite-plus/test` (vite-plus re-exports
 * its bundled vitest), so there is a SINGLE vitest copy and resolution works under
 * pnpm's global virtual store. We deliberately do NOT use `@effect/vitest`: it
 * pulls its own `vitest` + `@vitest/runner`, creating a second vitest instance
 * that clashes with the one `vp test` runs (and breaks GVS via an undeclared
 * `@vitest/runner`). This module re-implements the small slice of the
 * `@effect/vitest` ergonomics we want, on vitest's public API.
 */
import { Effect, Equal, Layer, ManagedRuntime, type Scope } from 'effect'
import { FastCheck, TestClock, TestConsole } from 'effect/testing'
import * as Vitest from 'vite-plus/test'

// Re-export the full vitest surface (describe, expect, vi, beforeAll, …). The
// explicit `it` export below shadows the star-exported one.
export * from 'vite-plus/test'

/** Services an `it.effect` body may use without providing them itself. */
export type TestEnv = TestClock.TestClock | TestConsole.TestConsole | Scope.Scope

const TestEnvLayer: Layer.Layer<TestClock.TestClock | TestConsole.TestConsole> = Layer.mergeAll(
  TestClock.layer(),
  TestConsole.layer,
)

const runTest = <A, E>(effect: Effect.Effect<A, E, TestEnv>): Promise<A> =>
  Effect.runPromise(Effect.scoped(Effect.provide(effect, TestEnvLayer)))

const runLive = <A, E>(effect: Effect.Effect<A, E, Scope.Scope>): Promise<A> =>
  Effect.runPromise(Effect.scoped(effect))

type EffectBody<A, E, R> = (ctx: Vitest.TestContext) => Effect.Effect<A, E, R>

/** Arbitrary tuple → the tuple of generated values it produces. */
type ArbsValues<Arbs extends ReadonlyArray<FastCheck.Arbitrary<unknown>>> = {
  [K in keyof Arbs]: Arbs[K] extends FastCheck.Arbitrary<infer T> ? T : never
}

const effectHelpers = {
  /** Run an Effect as a test, with a virtual TestClock + captured TestConsole and a Scope. */
  effect: <A, E>(name: string, body: EffectBody<A, E, TestEnv>, timeout?: number) =>
    Vitest.it(name, (ctx) => runTest(body(ctx)), timeout),
  /** Like {@link effect} but with the live environment (real Clock/Console). */
  live: <A, E>(name: string, body: EffectBody<A, E, Scope.Scope>, timeout?: number) =>
    Vitest.it(name, (ctx) => runLive(body(ctx)), timeout),
  /** Alias of {@link effect} emphasizing that the body may acquire scoped resources. */
  scoped: <A, E>(name: string, body: EffectBody<A, E, TestEnv>, timeout?: number) =>
    Vitest.it(name, (ctx) => runTest(body(ctx)), timeout),
  /** Property test whose body returns an Effect. Each generated case runs as an Effect. */
  prop: <const Arbs extends ReadonlyArray<FastCheck.Arbitrary<unknown>>, A, E>(
    name: string,
    arbitraries: Arbs,
    body: (args: ArbsValues<Arbs>) => Effect.Effect<A, E, TestEnv>,
    timeout?: number,
  ) =>
    Vitest.it(
      name,
      async () => {
        // fast-check's arbitrary arities are overloaded; the public signature
        // above stays typed via ArbsValues, so the variadic plumbing is cast.
        const fc = FastCheck as unknown as {
          assert: (p: unknown) => Promise<void>
          asyncProperty: (...a: unknown[]) => unknown
        }
        await fc.assert(
          fc.asyncProperty(...arbitraries, (...args: unknown[]) =>
            runTest(body(args as ArbsValues<Arbs>)),
          ),
        )
      },
      timeout,
    ),
}

/** Effect-native test methods bound to a provided layer (no `.live` — the layer is the env). */
export interface ScopedMethods<R> {
  effect: <A, E>(name: string, body: EffectBody<A, E, R | TestEnv>, timeout?: number) => void
  scoped: <A, E>(name: string, body: EffectBody<A, E, R | TestEnv>, timeout?: number) => void
  prop: <const Arbs extends ReadonlyArray<FastCheck.Arbitrary<unknown>>, A, E>(
    name: string,
    arbitraries: Arbs,
    body: (args: ArbsValues<Arbs>) => Effect.Effect<A, E, R | TestEnv>,
    timeout?: number,
  ) => void
}

/** A layer-bound test suite: call with an optional name + a body that receives scoped `it` methods. */
export interface LayerSuite<R> {
  (name: string, f: (it: ScopedMethods<R>) => void): void
  (f: (it: ScopedMethods<R>) => void): void
}

/**
 * Provide a `Layer` to a group of Effect tests. The layer is built ONCE
 * (memoized via a `ManagedRuntime`), shared across every test in the group, and
 * disposed in `afterAll`. The bound `it` inside the suite runs each body with the
 * layer's services plus a TestClock/TestConsole/Scope.
 *
 * @example
 * ```ts
 * layer(MyService.Default)('with MyService', (it) => {
 *   it.effect('uses the service', () =>
 *     Effect.gen(function* () {
 *       const svc = yield* MyService
 *       expect(yield* svc.value).toBe(1)
 *     }))
 * })
 * ```
 */
export const layer =
  <R, E>(
    layer_: Layer.Layer<R, E, never>,
    options?: { readonly timeout?: number },
  ): LayerSuite<R> =>
  (...args: [string, (it: ScopedMethods<R>) => void] | [(it: ScopedMethods<R>) => void]) => {
    const hasName = typeof args[0] === 'string'
    const name = hasName ? (args[0] as string) : undefined
    const f = (hasName ? args[1] : args[0]) as (it: ScopedMethods<R>) => void

    const runtime = ManagedRuntime.make(Layer.merge(layer_, TestEnvLayer))
    const runScoped = <A, E2>(effect: Effect.Effect<A, E2, R | TestEnv>): Promise<A> =>
      runtime.runPromise(Effect.scoped(effect))

    const boundIt: ScopedMethods<R> = {
      effect: (n, body, t) => Vitest.it(n, (ctx) => runScoped(body(ctx)), t),
      scoped: (n, body, t) => Vitest.it(n, (ctx) => runScoped(body(ctx)), t),
      prop: (n, arbitraries, body, t) =>
        Vitest.it(
          n,
          async () => {
            const fc = FastCheck as unknown as {
              assert: (p: unknown) => Promise<void>
              asyncProperty: (...a: unknown[]) => unknown
            }
            await fc.assert(
              fc.asyncProperty(...arbitraries, (...as_: unknown[]) =>
                runScoped(body(as_ as ArbsValues<typeof arbitraries>)),
              ),
            )
          },
          t,
        ),
    }

    const register = () => {
      Vitest.afterAll(() => runtime.dispose(), options?.timeout)
      f(boundIt)
    }
    if (name === undefined) register()
    else Vitest.describe(name, register)
  }

/**
 * vitest's `it`, extended with Effect-native variants (`it.effect`, `it.live`,
 * `it.scoped`, `it.prop`, `it.layer`). Composed as a NEW object — vite-plus's
 * exported `it` is never mutated.
 */
export const it: typeof Vitest.it & typeof effectHelpers & { layer: typeof layer } = Object.assign(
  ((...args: Parameters<typeof Vitest.it>) => Vitest.it(...args)) as typeof Vitest.it,
  Vitest.it,
  effectHelpers,
  { layer },
)

/**
 * Register an Effect-`Equal`-aware equality tester on `expect`, so
 * `expect(a).toEqual(b)` honors the Effect `Equal` trait (Option, Either, Exit,
 * Data, schema classes, …). Non-`Equal` values fall through to vitest's defaults.
 */
export const addEqualityTesters = (): void => {
  Vitest.expect.addEqualityTesters([
    function (a: unknown, b: unknown): boolean | undefined {
      const aEq = Equal.isEqual(a)
      const bEq = Equal.isEqual(b)
      if (aEq && bEq) return Equal.equals(a, b)
      if (aEq !== bEq) return false
      return undefined
    },
  ])
}

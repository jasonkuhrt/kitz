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
export * as Path from './path.js'

/** Services an `it.effect` body may use without providing them itself. */
export type TestEnv = TestClock.TestClock | TestConsole.TestConsole | Scope.Scope

const TestEnvLayer: Layer.Layer<TestClock.TestClock | TestConsole.TestConsole> = Layer.mergeAll(
  TestClock.layer(),
  TestConsole.layer,
)

type TestTimeout = number | Vitest.TestOptions

const testOptions = (timeout?: TestTimeout): Vitest.TestOptions =>
  typeof timeout === 'number' ? { timeout } : (timeout ?? {})

type RunEffect<$R> = <$A, $E>(
  effect: Effect.Effect<$A, $E, $R>,
  ctx: Vitest.TestContext,
) => Promise<$A>

const runTest: RunEffect<TestEnv> = (effect, ctx) =>
  Effect.runPromise(Effect.scoped(Effect.provide(effect, TestEnvLayer)), {
    signal: ctx.signal,
  })

const runLive: RunEffect<Scope.Scope> = (effect, ctx) =>
  Effect.runPromise(Effect.scoped(effect), { signal: ctx.signal })

type EffectBody<$A, $E, $R, $Args extends readonly unknown[] = [Vitest.TestContext]> = (
  ...args: $Args
) => Effect.Effect<$A, $E, $R>

/** Arbitrary tuple → the tuple of generated values it produces. */
type ArbsValues<$Arbs extends readonly unknown[]> = {
  [$K in keyof $Arbs]: $Arbs[$K] extends { generate: infer $Generate }
    ? $Generate extends (...args: infer _) => infer $Result
      ? $Result extends { readonly value: infer $Value }
        ? $Value
        : never
      : never
    : never
}

interface EffectTest<$R> {
  <$A, $E>(name: string, body: EffectBody<$A, $E, $R>, timeout?: TestTimeout): void
}

/** A complete Vitest tester whose test bodies return Effects. */
export interface EffectTester<$R> extends EffectTest<$R> {
  readonly skip: EffectTest<$R>
  readonly skipIf: (condition: unknown) => EffectTest<$R>
  readonly runIf: (condition: unknown) => EffectTest<$R>
  readonly only: EffectTest<$R>
  readonly each: <$Case>(
    cases: ReadonlyArray<$Case>,
  ) => <$A, $E>(name: string, body: EffectBody<$A, $E, $R, [$Case]>, timeout?: TestTimeout) => void
  readonly fails: EffectTest<$R>
  readonly prop: <const $Arbs extends readonly unknown[], $A, $E>(
    name: string,
    arbitraries: $Arbs,
    body: NoInfer<
      $Arbs extends ReadonlyArray<FastCheck.Arbitrary<any>>
        ? EffectBody<$A, $E, $R, [ArbsValues<$Arbs>, Vitest.TestContext]>
        : never
    >,
    timeout?: TestTimeout,
  ) => void
}

const makeTester = <$R>(runEffect: RunEffect<$R>, testApi: Vitest.TestAPI): EffectTester<$R> => {
  const run = <$A, $E, const $Args extends readonly unknown[]>(
    ctx: Vitest.TestContext,
    args: $Args,
    body: EffectBody<$A, $E, $R, $Args>,
  ): Promise<$A> =>
    runEffect(
      Effect.suspend(() => body(...args)),
      ctx,
    )

  const test: EffectTest<$R> = (name, body, timeout) =>
    testApi(name, testOptions(timeout), (ctx) => run(ctx, [ctx], body))

  const skip: EffectTest<$R> = (name, body, timeout) =>
    testApi.skip(name, testOptions(timeout), (ctx) => run(ctx, [ctx], body))

  const skipIf =
    (condition: unknown): EffectTest<$R> =>
    (name, body, timeout) =>
      testApi.skipIf(condition)(name, testOptions(timeout), (ctx) => run(ctx, [ctx], body))

  const runIf =
    (condition: unknown): EffectTest<$R> =>
    (name, body, timeout) =>
      testApi.runIf(condition)(name, testOptions(timeout), (ctx) => run(ctx, [ctx], body))

  const only: EffectTest<$R> = (name, body, timeout) =>
    testApi.only(name, testOptions(timeout), (ctx) => run(ctx, [ctx], body))

  const each: EffectTester<$R>['each'] = (cases) => (name, body, timeout) =>
    testApi.for(cases)(name, testOptions(timeout), (case_, ctx) =>
      run(ctx, [case_], body).then(() => undefined),
    )

  const fails: EffectTest<$R> = (name, body, timeout) =>
    testApi.fails(name, testOptions(timeout), (ctx) => run(ctx, [ctx], body))

  const prop: EffectTester<$R>['prop'] = (name, arbitraries, body, timeout) =>
    testApi(name, testOptions(timeout), async (ctx) => {
      // fast-check's arbitrary arities are overloaded; the public signature
      // above stays typed via ArbsValues, so the variadic plumbing is cast.
      const fc = FastCheck as unknown as {
        assert: (property: unknown) => Promise<void>
        asyncProperty: (...args: unknown[]) => unknown
      }
      await fc.assert(
        fc.asyncProperty(...arbitraries, (...args: unknown[]) =>
          run(ctx, [args as ArbsValues<typeof arbitraries>, ctx], body),
        ),
      )
    })

  return Object.assign(test, { skip, skipIf, runIf, only, each, fails, prop })
}

type EffectMethods<$R> = {
  readonly effect: EffectTester<$R>
  readonly scoped: EffectTester<$R>
  /** Compatibility alias for {@link EffectTester.prop}; prefer `it.effect.prop`. */
  readonly prop: EffectTester<$R>['prop']
}

type NativeMethods<$R> = typeof Vitest.it &
  EffectMethods<$R> & {
    readonly skip: typeof Vitest.it.skip & EffectMethods<$R>
    readonly only: typeof Vitest.it.only & EffectMethods<$R>
    readonly fails: typeof Vitest.it.fails & EffectMethods<$R>
  }

type RootEffectMethods = EffectMethods<TestEnv> & {
  readonly live: EffectTester<Scope.Scope>
  readonly layer: typeof layer
}

type RootMethods = typeof Vitest.it &
  RootEffectMethods & {
    readonly skip: typeof Vitest.it.skip & RootEffectMethods
    readonly only: typeof Vitest.it.only & RootEffectMethods
    readonly fails: typeof Vitest.it.fails & RootEffectMethods
  }

const reverseModifiers = new Set<PropertyKey>(['skip', 'only', 'fails'])

const makeItProxy = <$Methods extends object>(
  testApi: Vitest.TestAPI,
  makeOverrides: (testApi: Vitest.TestAPI) => $Methods,
): $Methods & Vitest.TestAPI => {
  const overrides = makeOverrides(testApi)
  return new Proxy(testApi as $Methods & Vitest.TestAPI, {
    apply(target, thisArg, args) {
      return Reflect.apply(target, thisArg, args)
    },
    get(target, property, receiver) {
      if (property in overrides) return Reflect.get(overrides, property)
      const value = Reflect.get(target, property, receiver)
      if (reverseModifiers.has(property) && typeof value === 'function') {
        return makeItProxy(value as Vitest.TestAPI, makeOverrides)
      }
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}

/** Effect-native test methods bound to a provided layer (no `.live` — the layer is the env). */
export type ScopedMethods<$R> = NativeMethods<$R | TestEnv>

/** A layer-bound test suite: call with an optional name + a body that receives scoped `it` methods. */
export interface LayerSuite<$R> {
  (name: string, f: (it: ScopedMethods<$R>) => void): void
  (f: (it: ScopedMethods<$R>) => void): void
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
  <$R, $E>(
    layer_: Layer.Layer<$R, $E, never>,
    options?: { readonly timeout?: number },
  ): LayerSuite<$R> =>
  (...args: [string, (it: ScopedMethods<$R>) => void] | [(it: ScopedMethods<$R>) => void]) => {
    const hasName = typeof args[0] === 'string'
    const name = hasName ? (args[0] as string) : undefined
    const f = (hasName ? args[1] : args[0]) as (it: ScopedMethods<$R>) => void

    const runtime = ManagedRuntime.make(Layer.merge(layer_, TestEnvLayer))
    const runScoped: RunEffect<$R | TestEnv> = (effect, ctx) =>
      runtime.runPromise(Effect.scoped(effect), { signal: ctx.signal })

    const boundIt = makeItProxy(Vitest.it.extend({}), (testApi) => {
      const effect = makeTester(runScoped, testApi)
      return {
        effect,
        scoped: makeTester(runScoped, testApi),
        prop: effect.prop,
      }
    }) as ScopedMethods<$R>

    const register = () => {
      Vitest.afterAll(() => runtime.dispose(), options?.timeout)
      f(boundIt)
    }
    if (name === undefined) register()
    else Vitest.describe(name, register)
  }

/**
 * vitest's `it`, extended with complete Effect-native testers (`it.effect`,
 * `it.live`, `it.scoped`) and `it.layer`. Composed as a NEW object — vite-plus's
 * exported `it` is never mutated. Every runner follows Vitest cancellation via
 * the current test context's abort signal.
 */
export const it = makeItProxy(Vitest.it.extend({}), (testApi) => {
  const effect = makeTester(runTest, testApi)
  return {
    effect,
    live: makeTester(runLive, testApi),
    scoped: makeTester(runTest, testApi),
    prop: effect.prop,
    layer,
  }
}) as RootMethods

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

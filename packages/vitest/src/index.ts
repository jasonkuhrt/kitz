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
import { Cause, Effect, Equal, Layer, ManagedRuntime, type Schema, type Scope } from 'effect'
import { TestClock, TestConsole } from 'effect/testing'
import * as Arbitrary from 'effect/unstable/arbitrary/Arbitrary'
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

/** Vitest options for a property test; `arbitrary` configures the native checker (runs, size, seed, …). */
export type PropertyTestOptions = Vitest.TestOptions & {
  readonly arbitrary?: Arbitrary.CheckOptions | undefined
}

type PropertyTimeout = number | PropertyTestOptions

const testOptions = (timeout?: TestTimeout): Vitest.TestOptions =>
  typeof timeout === 'number' ? { timeout } : (timeout ?? {})

const splitPropertyOptions = (
  timeout?: PropertyTimeout,
): [Vitest.TestOptions, Arbitrary.CheckOptions | undefined] => {
  if (typeof timeout === 'number') return [{ timeout }, undefined]
  const { arbitrary, ...options } = timeout ?? {}
  return [options, arbitrary]
}

/**
 * How a tester runs one body: `provide` gives a single run its environment (a
 * fresh scope, plus fresh TestClock/TestConsole for `it.effect`), and `run`
 * executes the provided effect as a Vitest test body, following the test's
 * abort signal.
 */
interface TestRuntime<$R, $Provided> {
  provide<$A, $E>(effect: Effect.Effect<$A, $E, $R>): Effect.Effect<$A, $E, $Provided>
  run<$A, $E>(effect: Effect.Effect<$A, $E, $Provided>, ctx: Vitest.TestContext): Promise<$A>
}

const runPromise = <$A, $E>(effect: Effect.Effect<$A, $E>, ctx: Vitest.TestContext): Promise<$A> =>
  Effect.runPromise(effect, { signal: ctx.signal })

const testRuntime: TestRuntime<TestEnv, never> = {
  provide: (effect) => Effect.scoped(Effect.provide(effect, TestEnvLayer)),
  run: runPromise,
}

const liveRuntime: TestRuntime<Scope.Scope, never> = {
  provide: (effect) => Effect.scoped(effect),
  run: runPromise,
}

type EffectBody<$A, $E, $R, $Args extends readonly unknown[] = [Vitest.TestContext]> = (
  ...args: $Args
) => Effect.Effect<$A, $E, $R>

/** A property input: a Schema (derived with `Arbitrary.schema`) or a native `Arbitrary`. */
export type ArbitraryInput = Schema.Schema<any> | Arbitrary.Arbitrary<unknown>

/** Property inputs as a tuple or a record; the property body receives values of the same shape. */
export type Arbitraries = ReadonlyArray<ArbitraryInput> | { readonly [key: string]: ArbitraryInput }

type ArbitraryValue<$Input> =
  $Input extends Schema.Schema<infer $T>
    ? $T
    : $Input extends Arbitrary.Arbitrary<infer $T>
      ? $T
      : never

/** Property inputs → the generated values the property body receives. */
export type ArbitrariesValues<$Arbs extends Arbitraries> = {
  [$K in keyof $Arbs]: ArbitraryValue<$Arbs[$K]>
}

const isArbitraryTuple = (arbitraries: Arbitraries): arbitraries is ReadonlyArray<ArbitraryInput> =>
  Array.isArray(arbitraries)

const compileArbitraryInput = (input: ArbitraryInput): Arbitrary.Arbitrary<any> =>
  Arbitrary.isArbitrary(input) ? input : Arbitrary.schema(input)

const makeArbitrary = (arbitraries: Arbitraries): Arbitrary.Arbitrary<any> =>
  Arbitrary.all(
    isArbitraryTuple(arbitraries)
      ? arbitraries.map(compileArbitraryInput)
      : Object.fromEntries(
          Object.entries(arbitraries).map(([key, input]) => [key, compileArbitraryInput(input)]),
        ),
  )

/**
 * A property holds unless it returns `false`. Any non-interruption failure —
 * typed error, thrown exception, or defect such as a failed `expect` —
 * falsifies it and triggers shrinking; interruption still interrupts the test.
 */
const normalizeProperty = <$A, $E, $R>(
  property: (value: $A) => Effect.Effect<unknown, $E, $R>,
  value: $A,
): Effect.Effect<boolean, $E | Cause.Cause<$E>, $R> =>
  Effect.catchCauseIf(
    Effect.map(
      Effect.suspend(() => property(value)),
      (output) => output !== false,
    ),
    (cause) => !Cause.hasInterrupts(cause),
    (cause) => Effect.fail(cause),
  )

/** Check a property with the native runner; a falsification fails the test with the shrunk counterexample. */
const checkProperty = <$A, $E, $R>(
  arbitrary: Arbitrary.Arbitrary<$A>,
  property: (value: $A) => Effect.Effect<unknown, $E, $R>,
  options: Arbitrary.CheckOptions | undefined,
): Effect.Effect<void, never, $R> =>
  Effect.flatMap(
    Arbitrary.checkEffect(arbitrary, (value) => normalizeProperty(property, value), options),
    (result) => {
      const failure = Arbitrary.formatCheckFailure(result)
      return failure === undefined ? Effect.void : Effect.die(new Error(failure))
    },
  )

/**
 * Assert a property inside an ordinary test, synchronously, with the native
 * runner — the counterpart of fast-check's `assert(property(…))`. Inputs are
 * Schemas or native `Arbitrary` values, as a tuple or a record. The property
 * fails when it returns `false` or throws (e.g. a failed `expect`); the input
 * is then shrunk and the test throws the formatted counterexample.
 *
 * @example
 * ```ts
 * it('is idempotent', () => {
 *   assertProperty([Path.AbsDir], ([dir]) => {
 *     expect(normalize(normalize(dir))).toEqual(normalize(dir))
 *   })
 * })
 * ```
 */
export const assertProperty = <const $Arbs extends Arbitraries>(
  arbitraries: $Arbs,
  property: (values: ArbitrariesValues<$Arbs>) => unknown,
  options?: Arbitrary.CheckOptions,
): void =>
  Effect.runSync(
    checkProperty(
      makeArbitrary(arbitraries),
      (values: ArbitrariesValues<$Arbs>) => Effect.sync(() => property(values)),
      options,
    ),
  )

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
  /**
   * Property test over Schema or native `Arbitrary` inputs, given as a tuple or
   * a record. The body receives the generated values in the same shape. It
   * fails when the body's Effect succeeds with `false` or fails in any way
   * other than interruption, and the native runner then shrinks the input.
   * Configure the checker through `timeout.arbitrary`.
   */
  prop<const $Arbs extends Arbitraries, $A, $E>(
    name: string,
    arbitraries: $Arbs,
    body: NoInfer<EffectBody<$A, $E, $R, [ArbitrariesValues<$Arbs>, Vitest.TestContext]>>,
    timeout?: PropertyTimeout,
  ): void
}

const makeTester = <$R, $Provided>(
  runtime: TestRuntime<$R, $Provided>,
  testApi: Vitest.TestAPI,
): EffectTester<$R> => {
  const run = <$A, $E, const $Args extends readonly unknown[]>(
    ctx: Vitest.TestContext,
    args: $Args,
    body: EffectBody<$A, $E, $R, $Args>,
  ): Promise<$A> => runtime.run(runtime.provide(Effect.suspend(() => body(...args))), ctx)

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

  const prop: EffectTester<$R>['prop'] = (name, arbitraries, body, timeout) => {
    const arbitrary = makeArbitrary(arbitraries)
    const [options, checkOptions] = splitPropertyOptions(timeout)
    testApi(name, options, (ctx) =>
      runtime.run(
        checkProperty(
          arbitrary,
          (values) => runtime.provide(Effect.suspend(() => body(values, ctx))),
          checkOptions,
        ),
        ctx,
      ),
    )
  }

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
    const layerRuntime: TestRuntime<
      $R | TestEnv,
      $R | TestClock.TestClock | TestConsole.TestConsole
    > = {
      provide: (effect) => Effect.scoped(effect),
      run: (effect, ctx) => runtime.runPromise(effect, { signal: ctx.signal }),
    }

    const boundIt = makeItProxy(Vitest.it.extend({}), (testApi) => {
      const effect = makeTester(layerRuntime, testApi)
      return {
        effect,
        scoped: makeTester(layerRuntime, testApi),
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
  const effect = makeTester(testRuntime, testApi)
  return {
    effect,
    live: makeTester(liveRuntime, testApi),
    scoped: makeTester(testRuntime, testApi),
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

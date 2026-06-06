import { describe, expect, test } from 'bun:test'
import { Context, Effect, type Layer, Option } from 'effect'
import * as Mock from './mock.js'

// ─── Sample flat Context.Service under test ────────────────────────────────
//
// Mirrors the flat services the driver must support (Git, NpmCli): every
// method lives directly on the service and returns an Effect. One method
// returns an Effect<Option<_>> to exercise the Option helpers; one takes
// multiple args to exercise tuple normalization; one takes zero args; one is a
// synchronous (non-Effect) field to exercise `override`.

interface SampleService {
  readonly greet: (name: string) => Effect.Effect<string, SampleError>
  readonly add: (a: number, b: number) => Effect.Effect<number, SampleError>
  readonly ping: () => Effect.Effect<'pong', SampleError>
  readonly find: (id: string) => Effect.Effect<Option.Option<string>, SampleError>
  readonly label: string
}

class SampleError {
  readonly _tag = 'SampleError'
  constructor(readonly reason: string) {}
}

class Sample extends Context.Service<Sample, SampleService>()('Sample') {}

const run = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(effect as Effect.Effect<A>)
const runExit = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromiseExit(effect)

describe('Mock.make — per-method controls', () => {
  test('nextSuccess queues a single FIFO success', async () => {
    const sample = Mock.make(Sample)
    sample.greet.nextSuccess('hello alice')

    expect(await run(sample.greet('alice'))).toBe('hello alice')
  })

  test('next queues a raw implementation receiving normalized args', async () => {
    const sample = Mock.make(Sample)
    sample.greet.next((name) => Effect.succeed(`hi ${name}`))

    expect(await run(sample.greet('bob'))).toBe('hi bob')
  })

  test('next FIFO drains in order, then falls through to every', async () => {
    const sample = Mock.make(Sample)
    sample.greet.nextSuccess('first')
    sample.greet.nextSuccess('second')
    sample.greet.everySuccess('sticky')

    expect(await run(sample.greet('x'))).toBe('first')
    expect(await run(sample.greet('x'))).toBe('second')
    expect(await run(sample.greet('x'))).toBe('sticky')
    expect(await run(sample.greet('x'))).toBe('sticky')
  })

  test('everySuccess is sticky across all calls', async () => {
    const sample = Mock.make(Sample)
    sample.add.everySuccess(42)

    expect(await run(sample.add(1, 2))).toBe(42)
    expect(await run(sample.add(3, 4))).toBe(42)
  })

  test('nextFail / everyFail inject typed failures', async () => {
    const sample = Mock.make(Sample)
    const error = new SampleError('boom')
    sample.greet.nextFail(error)

    const exit = await runExit(sample.greet('x'))
    expect(exit._tag).toBe('Failure')

    sample.greet.everyFail(new SampleError('always'))
    const exit2 = await runExit(sample.greet('y'))
    expect(exit2._tag).toBe('Failure')
  })

  test('every receives normalized args', async () => {
    const sample = Mock.make(Sample)
    sample.add.every(([a, b]) => Effect.succeed(a + b))

    expect(await run(sample.add(2, 3))).toBe(5)
    expect(await run(sample.add(10, 20))).toBe(30)
  })

  test('zero-arg methods normalize args to undefined', async () => {
    const sample = Mock.make(Sample)
    sample.ping.everySuccess('pong')

    expect(await run(sample.ping())).toBe('pong')
    expect(sample.ping.calls).toEqual([[undefined]])
  })
})

describe('Mock.make — Option helpers', () => {
  test('nextSome / everySome wrap in Option.some', async () => {
    const sample = Mock.make(Sample)
    sample.find.nextSome('found-it')

    const result = await run(sample.find('id-1'))
    expect(Option.isSome(result)).toBe(true)
    expect(Option.getOrNull(result)).toBe('found-it')
  })

  test('nextNone / everyNone wrap in Option.none', async () => {
    const sample = Mock.make(Sample)
    sample.find.everyNone()

    const result = await run(sample.find('missing'))
    expect(Option.isNone(result)).toBe(true)
  })
})

describe('Mock.make — call inspection', () => {
  test('records calls with normalized single arg', async () => {
    const sample = Mock.make(Sample)
    sample.greet.everySuccess('ok')

    await run(sample.greet('alice'))
    await run(sample.greet('bob'))

    expect(sample.greet.calls).toEqual([['alice'], ['bob']])
  })

  test('records calls with normalized arg tuples', async () => {
    const sample = Mock.make(Sample)
    sample.add.everySuccess(0)

    await run(sample.add(1, 2))

    expect(sample.add.calls).toEqual([[[1, 2]]])
  })

  test('clear() drops recorded calls but keeps queued impls', async () => {
    const sample = Mock.make(Sample)
    sample.greet.everySuccess('ok')

    await run(sample.greet('a'))
    sample.greet.clear()
    expect(sample.greet.calls).toEqual([])

    // every impl survived clear()
    expect(await run(sample.greet('b'))).toBe('ok')
    expect(sample.greet.calls).toEqual([['b']])
  })

  test('reset() drops calls and queued impls', async () => {
    const sample = Mock.make(Sample)
    sample.greet.nextSuccess('one')
    await run(sample.greet('a'))
    sample.greet.reset()

    expect(sample.greet.calls).toEqual([])
    const exit = await runExit(sample.greet('b'))
    expect(exit._tag).toBe('Failure') // no impl after reset -> die
  })
})

describe('Mock.make — when() branch matching', () => {
  test('when() branch wins over global next', async () => {
    const sample = Mock.make(Sample)
    sample.greet.nextSuccess('global')
    sample.greet.when('vip').nextSuccess('special')

    expect(await run(sample.greet('vip'))).toBe('special')
    expect(await run(sample.greet('other'))).toBe('global')
  })

  test('when() deep-partial object matching', async () => {
    const sample = Mock.make(Sample)
    sample.add.when([1, 2]).everySuccess(999)
    sample.add.everySuccess(0)

    expect(await run(sample.add(1, 2))).toBe(999)
    expect(await run(sample.add(5, 6))).toBe(0)
  })

  test('branch next() FIFO drains before branch every()', async () => {
    const sample = Mock.make(Sample)
    const branch = sample.greet.when('a')
    branch.nextSuccess('once')
    branch.everySuccess('thereafter')

    expect(await run(sample.greet('a'))).toBe('once')
    expect(await run(sample.greet('a'))).toBe('thereafter')
  })
})

describe('Mock.make — $test controls', () => {
  test('layer() wires the mock as the service', async () => {
    const sample = Mock.make(Sample)
    sample.greet.everySuccess('from layer')

    const program = Effect.gen(function* () {
      const svc = yield* Sample
      return yield* svc.greet('x')
    })

    const result = await run(program.pipe(Effect.provide(sample.$test.layer())))
    expect(result).toBe('from layer')
  })

  test('clearCalls() clears every controller', async () => {
    const sample = Mock.make(Sample)
    sample.greet.everySuccess('ok')
    sample.ping.everySuccess('pong')

    await run(sample.greet('a'))
    await run(sample.ping())

    sample.$test.clearCalls()
    expect(sample.greet.calls).toEqual([])
    expect(sample.ping.calls).toEqual([])
  })

  test('reset() clears calls and impls across controllers', async () => {
    const sample = Mock.make(Sample)
    sample.greet.nextSuccess('x')
    await run(sample.greet('a'))

    sample.$test.reset()
    expect(sample.greet.calls).toEqual([])
    const exit = await runExit(sample.greet('b'))
    expect(exit._tag).toBe('Failure')
  })

  test('override() pins a synchronous field', () => {
    const sample = Mock.make(Sample)
    sample.$test.override({ label: 'overridden' })

    expect(sample.label).toBe('overridden')
  })
})

describe('Mock.make — missing-mock behavior', () => {
  test('calling a method with no impl dies with an unimplemented error', async () => {
    const sample = Mock.make(Sample)
    const exit = await runExit(sample.greet('x'))
    expect(exit._tag).toBe('Failure')
  })
})

// ─── Type-level contract proofs (enforced by `tsgo --noEmit`) ───────────────

describe('Mock.make — type contract', () => {
  test('public type surface holds', () => {
    const sample = Mock.make(Sample)

    // The driver method is still callable as the service method and returns
    // the service's Effect.
    const greetReturn: Effect.Effect<string, SampleError> = sample.greet('x')
    expect(greetReturn).toBeDefined()

    // nextSuccess accepts exactly the success type.
    sample.greet.nextSuccess('a string')
    // @ts-expect-error -- success channel is string, not number
    sample.greet.nextSuccess(123)

    // nextFail accepts exactly the error type.
    sample.greet.nextFail(new SampleError('x'))
    // @ts-expect-error -- error channel is SampleError, not a bare string
    sample.greet.nextFail('not an error')

    // Option helpers exist on an Option-returning method...
    sample.find.nextSome('value')
    sample.find.everyNone()

    // ...and are absent on a non-Option method.
    // @ts-expect-error -- greet's success is string, not Option, so no nextSome
    sample.greet.nextSome('value')
    // @ts-expect-error -- add's success is number, not Option, so no everyNone
    sample.add.everyNone()

    // calls is read-only inspection typed by normalized input.
    const greetCalls: ReadonlyArray<readonly [string]> = sample.greet.calls
    const addCalls: ReadonlyArray<readonly [readonly [number, number]]> = sample.add.calls
    const pingCalls: ReadonlyArray<readonly [undefined]> = sample.ping.calls
    expect(greetCalls).toBeDefined()
    expect(addCalls).toBeDefined()
    expect(pingCalls).toBeDefined()

    // $test.layer() is typed to the service identifier.
    const layer: Layer.Layer<Sample> = sample.$test.layer()
    expect(layer).toBeDefined()

    // override accepts synchronous fields and rejects method positions.
    sample.$test.override({ label: 'ok' })
    // @ts-expect-error -- greet is a method, not an overridable synchronous field
    sample.$test.override({ greet: 'nope' })
  })
})

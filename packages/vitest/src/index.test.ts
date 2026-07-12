import { Effect, Layer } from 'effect'
import { FastCheck } from 'effect/testing'
import { describe, expect, expectTypeOf, it } from './index.js'

describe('Effect tester surface', () => {
  it('types: exposes native tester modifiers in both directions', () => {
    expectTypeOf(it.effect.skip).toBeFunction()
    expectTypeOf(it.effect.skipIf).toBeFunction()
    expectTypeOf(it.effect.runIf).toBeFunction()
    expectTypeOf(it.effect.only).toBeFunction()
    expectTypeOf(it.effect.each).toBeFunction()
    expectTypeOf(it.effect.fails).toBeFunction()
    expectTypeOf(it.effect.prop).toBeFunction()
    expectTypeOf(it.live.skip).toBeFunction()
    expectTypeOf(it.live.only).toBeFunction()
    expectTypeOf(it.scoped.skip).toBeFunction()
    expectTypeOf(it.scoped.only).toBeFunction()
    expectTypeOf(it.skip.effect).toBeFunction()
    expectTypeOf(it.skip.live).toBeFunction()
    expectTypeOf(it.skip.scoped).toBeFunction()
    expectTypeOf(it.only.effect).toBeFunction()
    expectTypeOf(it.fails.effect).toBeFunction()
  })

  it.layer(Layer.empty)('layer-bound tester surface', (layerIt) => {
    layerIt.effect('types: exposes native tester modifiers', () => {
      expectTypeOf(layerIt.effect.skip).toBeFunction()
      expectTypeOf(layerIt.effect.skipIf).toBeFunction()
      expectTypeOf(layerIt.effect.runIf).toBeFunction()
      expectTypeOf(layerIt.effect.only).toBeFunction()
      expectTypeOf(layerIt.effect.each).toBeFunction()
      expectTypeOf(layerIt.effect.fails).toBeFunction()
      expectTypeOf(layerIt.effect.prop).toBeFunction()
      expectTypeOf(layerIt.scoped.skip).toBeFunction()
      expectTypeOf(layerIt.skip.effect).toBeFunction()
      return Effect.void
    })

    layerIt.effect.each([{ value: 1 }])('runs layer-bound table cases', ({ value }) =>
      Effect.sync(() => expectTypeOf(value).toEqualTypeOf<number>()),
    )
  })

  it.effect.each([{ value: 1 }])('runs Effect table cases', ({ value }) =>
    Effect.sync(() => expectTypeOf(value).toEqualTypeOf<number>()),
  )

  it.effect.prop(
    'runs Effect property cases',
    [FastCheck.constant(1)] as const,
    ([value]: readonly [number], ctx) =>
      Effect.sync(() => {
        expect(value).toBe(1)
        expectTypeOf(ctx).toEqualTypeOf<import('vite-plus/test').TestContext>()
      }),
  )

  it.effect.fails(
    'threads the Vitest cancellation signal into the Effect fiber',
    (ctx: import('vite-plus/test').TestContext) =>
      Effect.callback<never>(() => {
        queueMicrotask(() => ctx.signal.dispatchEvent(new Event('abort')))
        return Effect.void
      }),
    250,
  )
})

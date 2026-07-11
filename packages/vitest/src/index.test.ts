import { Effect, Layer } from 'effect'
import { describe, expectTypeOf, it } from './index.js'

describe('Effect tester surface', () => {
  it('types: exposes native tester modifiers in both directions', () => {
    // @ts-expect-error RED-PIN: effect helpers are currently bare functions
    expectTypeOf(it.effect.skip).toBeFunction()
    // @ts-expect-error RED-PIN: effect helpers are currently bare functions
    expectTypeOf(it.effect.only).toBeFunction()
    // @ts-expect-error RED-PIN: effect helpers are currently bare functions
    expectTypeOf(it.effect.each).toBeFunction()
    // @ts-expect-error RED-PIN: native testers do not currently expose Effect helpers
    expectTypeOf(it.skip.effect).toBeFunction()
  })

  it.layer(Layer.empty)('layer-bound tester surface', (layerIt) => {
    layerIt.effect('types: exposes native tester modifiers', () => {
      // @ts-expect-error RED-PIN: layer-bound Effect helpers are bare functions
      expectTypeOf(layerIt.effect.skip).toBeFunction()
      // @ts-expect-error RED-PIN: layer-bound Effect helpers are bare functions
      expectTypeOf(layerIt.effect.only).toBeFunction()
      // @ts-expect-error RED-PIN: layer-bound Effect helpers are bare functions
      expectTypeOf(layerIt.effect.each).toBeFunction()
      return Effect.void
    })
  })

  // @ts-expect-error RED-PIN: effect tester has no fails modifier yet
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

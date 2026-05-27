import { describe, expect, it } from 'bun:test'
import { Effect, Layer, Context } from 'effect'
import { SlotValues, makeSlotValuesLayer, buildExecutableEffect } from './slot-values.js'

describe('SlotValues', () => {
  it('provides slot values to a capability effect', async () => {
    const values = { format: 'json', output: '/tmp/out' }
    const layer = makeSlotValuesLayer(values)

    const effect = Effect.gen(function* () {
      const sv = yield* SlotValues
      return sv
    })

    const result = await Effect.runPromise(Effect.provide(effect, layer))
    expect(result).toEqual({ format: 'json', output: '/tmp/out' })
  })

  it('capability sees only its declared slots', async () => {
    const capabilitySlots = { format: 'yaml' }
    const layer = makeSlotValuesLayer(capabilitySlots)

    const effect = Effect.gen(function* () {
      const sv = yield* SlotValues
      return sv
    })

    const result = await Effect.runPromise(Effect.provide(effect, layer))
    expect(result).toEqual({ format: 'yaml' })
    expect((result as any).output).toBeUndefined()
  })

  it('buildExecutableEffect provides slot values', async () => {
    let captured: Record<string, unknown> = {}
    const execute = Effect.gen(function* () {
      captured = yield* SlotValues
    })

    const built = buildExecutableEffect(execute, { name: 'test-project' })
    await Effect.runPromise(built)
    expect(captured).toEqual({ name: 'test-project' })
  })

  it('buildExecutableEffect merges additional layers', async () => {
    class TestService extends Context.Service<TestService, { readonly value: string }>()(
      'test/TestService',
    ) {}

    let capturedSlots: Record<string, unknown> = {}
    let capturedService = ''

    const execute = Effect.gen(function* () {
      capturedSlots = yield* SlotValues
      capturedService = (yield* TestService).value
    })

    const testLayer = Layer.succeed(TestService)({ value: 'hello' })
    const built = buildExecutableEffect(execute, { format: 'json' }, testLayer)
    await Effect.runPromise(built)

    expect(capturedSlots).toEqual({ format: 'json' })
    expect(capturedService).toBe('hello')
  })

  it('handles empty slot values', async () => {
    const layer = makeSlotValuesLayer({})

    const effect = Effect.gen(function* () {
      return yield* SlotValues
    })

    const result = await Effect.runPromise(Effect.provide(effect, layer))
    expect(result).toEqual({})
  })
})

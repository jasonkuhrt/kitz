import { describe, expect, it } from 'vitest'
import { Effect, Schema as S } from 'effect'
import { Capability } from './capability.js'
import { Slot } from './slot.js'

describe('Capability.make', () => {
  it('creates with name and execute', () => {
    const cap = Capability.make({
      name: 'reload',
      execute: Effect.void,
    })
    expect(cap._tag).toBe('Capability')
    expect(cap.name).toBe('reload')
    expect(cap.slots).toEqual([])
  })

  it('creates with slots', () => {
    const formatSlot = Slot.Enum.make({ name: 'format', schema: S.Literal('json', 'yaml') })
    const cap = Capability.make({
      name: 'export',
      slots: [formatSlot],
      execute: Effect.void,
    })
    expect(cap.slots).toHaveLength(1)
    expect(cap.slots[0].name).toBe('format')
  })
})

describe('Capability.Composite.make', () => {
  it('creates with steps', () => {
    const step1 = Capability.make({ name: 'write', execute: Effect.void })
    const step2 = Capability.make({ name: 'reload', execute: Effect.void })
    const composite = Capability.Composite.make({
      name: 'write-and-reload',
      steps: [{ capability: step1 }, { capability: step2 }],
    })
    expect(composite._tag).toBe('Composite')
    expect(composite.steps).toHaveLength(2)
    expect(composite.slots).toEqual([])
  })

  it('aggregates slots from steps', () => {
    const step1 = Capability.make({ name: 'write', execute: Effect.void })
    const formatSlot = Slot.Enum.make({ name: 'format', schema: S.Literal('json', 'yaml') })
    const step2 = Capability.make({
      name: 'export',
      slots: [formatSlot],
      execute: Effect.void,
    })
    const composite = Capability.Composite.make({
      name: 'write-and-export',
      steps: [{ capability: step1 }, { capability: step2 }],
    })
    expect(composite.slots).toHaveLength(1)
    expect(composite.slots[0].name).toBe('format')
  })

  it('aggregates slots from multiple slotted steps', () => {
    const formatSlot = Slot.Enum.make({ name: 'format', schema: S.Literal('json') })
    const destSlot = Slot.Text.make({ name: 'destination', schema: S.String })
    const step1 = Capability.make({ name: 'export', slots: [formatSlot], execute: Effect.void })
    const step2 = Capability.make({ name: 'upload', slots: [destSlot], execute: Effect.void })
    const composite = Capability.Composite.make({
      name: 'export-and-upload',
      steps: [{ capability: step1 }, { capability: step2 }],
    })
    expect(composite.slots).toHaveLength(2)
    expect(composite.slots.map((s) => s.name)).toEqual(['format', 'destination'])
  })

  it('throws CmxDuplicateSlot on slot name collision', () => {
    const slot1 = Slot.Enum.make({ name: 'format', schema: S.Literal('json') })
    const slot2 = Slot.Enum.make({ name: 'format', schema: S.Literal('yaml') })
    const step1 = Capability.make({ name: 'a', slots: [slot1], execute: Effect.void })
    const step2 = Capability.make({ name: 'b', slots: [slot2], execute: Effect.void })
    expect(() =>
      Capability.Composite.make({
        name: 'dup',
        steps: [{ capability: step1 }, { capability: step2 }],
      }),
    ).toThrow(/format/)
  })
})

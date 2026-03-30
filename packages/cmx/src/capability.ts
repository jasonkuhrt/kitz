import type { Effect } from 'effect'
import type { AnySlot } from './slot.js'
import { CmxDuplicateSlot } from './errors.js'

/** A simple capability — the smallest executable unit. */
export interface CapabilitySimple {
  readonly _tag: 'Capability'
  readonly name: string
  readonly slots: ReadonlyArray<AnySlot>
  readonly execute: Effect.Effect<void, unknown, unknown>
}

/** A composite capability — ordered sequence of other capabilities. */
export interface CapabilityComposite {
  readonly _tag: 'Composite'
  readonly name: string
  readonly slots: ReadonlyArray<AnySlot>
  readonly steps: ReadonlyArray<{ readonly capability: AnyCapability }>
}

/** Any capability kind. */
export type AnyCapability = CapabilitySimple | CapabilityComposite

/**
 * Aggregates slots from all steps.
 * Throws CmxDuplicateSlot if two steps declare the same slot name.
 */
const aggregateSlots = (
  steps: ReadonlyArray<{ readonly capability: AnyCapability }>,
): ReadonlyArray<AnySlot> => {
  const seen = new Map<string, string>()
  const result: AnySlot[] = []
  for (const step of steps) {
    for (const slot of step.capability.slots) {
      const existing = seen.get(slot.name)
      if (existing) {
        throw new CmxDuplicateSlot({
          context: {
            slot: slot.name,
            capabilityA: existing,
            capabilityB: step.capability.name,
          },
        })
      }
      seen.set(slot.name, step.capability.name)
      result.push(slot)
    }
  }
  return result
}

export const Capability = {
  make: (config: {
    readonly name: string
    readonly slots?: ReadonlyArray<AnySlot>
    readonly execute: Effect.Effect<void, unknown, unknown>
  }): CapabilitySimple => ({
    _tag: 'Capability',
    name: config.name,
    slots: config.slots ?? [],
    execute: config.execute,
  }),

  Composite: {
    make: (config: {
      readonly name: string
      readonly steps: ReadonlyArray<{ readonly capability: AnyCapability }>
    }): CapabilityComposite => ({
      _tag: 'Composite',
      name: config.name,
      slots: aggregateSlots(config.steps),
      steps: config.steps,
    }),
  },
} as const

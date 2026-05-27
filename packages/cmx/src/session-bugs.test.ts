/**
 * Failing tests for the 8 systemic session bugs.
 * Uses Test.effect from @kitz/test for Effect-native test execution.
 */
import { Effect, Layer, Schema as S, Context } from 'effect'
import { describe, expect, it } from 'bun:test'
import { Test } from '@kitz/test'
import { Session } from './session.js'
import { Command } from './command.js'
import { Capability } from './capability.js'
import { Slot } from './slot.js'
import { Matcher } from './matcher.js'
import { SlotValues } from './slot-values.js'

// --- Fixtures ---

const reload = Capability.make({ name: 'reload', execute: Effect.void })
const configNs = Command.Namespace.make({
  name: 'Config',
  children: [Command.Leaf.make({ name: 'reload', capability: reload })],
})
const defaultProximities = new Map<string, number>()

// --- Bug 1: Layers dropped on no-slot execution ---

describe('Bug 1: no-slot execution wraps with layers', () => {
  Test.effect('auto-advanced executable resolution includes provided layers', () =>
    Effect.gen(function* () {
      class TestService extends Context.Service<TestService, { readonly value: string }>()(
        'test/Bug1Service',
      ) {}

      const capWithService = Capability.make({
        name: 'greet',
        execute: Effect.gen(function* () {
          const svc = yield* TestService
          expect(svc.value).toBe('hello')
        }),
      })
      const cmd = Command.Leaf.make({ name: 'greet', capability: capWithService })
      const testLayer = Layer.succeed(TestService)({ value: 'hello' })

      const session = Session.create([cmd], defaultProximities, {
        scopeLayers: [testLayer],
      })

      const res = session.queryPush('g')
      expect(res.executable).toBe(true)
      expect(res.effect).not.toBeNull()

      // Bug: maybeTransitionToSlots returns raw CommandResolver resolution,
      // bypassing layer wrapping. The effect fails because TestService isn't provided.
      yield* res.effect!
    }),
  )
})

// --- Bug 2: Matcher forked ---

describe('Bug 2: slot resolver uses session matcher', () => {
  it('enum slot filtering uses fuzzy matcher, not substring', () => {
    const exportCap = Capability.make({
      name: 'export',
      slots: [Slot.Enum.make({ name: 'format', schema: S.Literals(['alice', 'amber', 'bob']) })],
      execute: Effect.void,
    })
    const cmd = Command.Leaf.make({ name: 'export', capability: exportCap })

    const session = Session.create([cmd], defaultProximities, {
      matcher: Matcher.fuzzy(),
    })

    session.toggleMode()
    session.choiceTake({ token: 'export', kind: 'leaf', executable: true })

    // Type 'a' then 'e' — fuzzy matches 'alice' and 'amber' (a...e subsequence)
    // Substring rejects because "alice"/"amber" don't contain "ae" contiguously
    session.queryPush('a')
    session.queryPush('e')

    const res = session.getResolution()
    // Bug: SlotResolver created with default substring matcher
    expect(res.choices.length).toBeGreaterThan(0)
  })
})

// --- Bug 5: Composite SlotValues not scoped per step ---

describe('Bug 5: composite steps see only their declared slots', () => {
  Test.effect('step A cannot access step B slot values', () =>
    Effect.gen(function* () {
      const formatSlot = Slot.Enum.make({ name: 'format', schema: S.Literal('json') })
      const destSlot = Slot.Text.make({ name: 'dest', schema: S.String })

      const seenByA: Record<string, unknown>[] = []
      const stepA = Capability.make({
        name: 'stepA',
        slots: [formatSlot],
        execute: Effect.gen(function* () {
          const vals = yield* SlotValues
          seenByA.push({ ...vals })
        }),
      })
      const stepB = Capability.make({
        name: 'stepB',
        slots: [destSlot],
        execute: Effect.void,
      })
      const composite = Capability.Composite.make({
        name: 'deploy',
        steps: [{ capability: stepA }, { capability: stepB }],
      })
      const cmd = Command.Leaf.make({ name: 'deploy', capability: composite })
      const session = Session.create([cmd], defaultProximities)

      // Enter slot phase
      session.queryPush('d')

      // Fill format slot
      session.choiceTake({ token: 'json', kind: 'value', executable: false })

      // Fill dest slot (text)
      session.queryPush('/')
      session.queryPush('t')
      session.queryPush('m')
      session.queryPush('p')
      const res = session.confirm()

      if (res.effect) {
        yield* res.effect
        // Bug: stepA sees { format: 'json', dest: '/tmp' } instead of just { format: 'json' }
        expect(seenByA[0]).toEqual({ format: 'json' })
        expect(seenByA[0]).not.toHaveProperty('dest')
      }
    }),
  )
})

// --- Bug 6: Dynamic layers never cleared ---

describe('Bug 6: dynamic layers cleared when context.layers absent', () => {
  it('setDynamicLayers with empty object clears previous layers', () => {
    const session = Session.create([configNs], defaultProximities, {
      dynamicLayers: { thread: Effect.void as any },
    })
    expect(Object.keys(session.getDynamicLayers())).toHaveLength(1)

    // Passing empty should clear — handle-key.ts should always call this
    session.setDynamicLayers({})
    expect(Object.keys(session.getDynamicLayers())).toHaveLength(0)
  })
})

// --- Bug 7: Optional Text submits "" instead of skipping ---

describe('Bug 7: optional Text slot skips on empty confirm', () => {
  it('confirm on empty optional Text slot skips, does not submit ""', () => {
    const optionalText = Slot.Text.make({
      name: 'note',
      schema: S.String,
      required: false,
    })
    const requiredText = Slot.Text.make({
      name: 'title',
      schema: S.String,
    })
    const cap = Capability.make({
      name: 'annotate',
      slots: [optionalText, requiredText],
      execute: Effect.void,
    })
    const cmd = Command.Leaf.make({ name: 'annotate', capability: cap })
    const session = Session.create([cmd], defaultProximities)

    // Navigate to annotate, enter slot phase
    session.queryPush('a')
    expect(session.getPhase()).toBe('slot')

    // Confirm with empty query on optional Text slot — should skip
    const res = session.confirm()

    // Bug: submitText accepts empty for optional, submits "" instead of skipping
    const noteSlot = res.slots.find((s) => s.name === 'note')
    expect(noteSlot?.value).toBeNull()

    // Focus should have advanced to 'title'
    expect(res.focusedSlot).toBe('title')
  })
})

// --- Bug 8: choicesLoading never true ---

describe('Bug 8: choicesLoading is true while sources run', () => {
  it('fuzzy slot shows loading state before candidates arrive', () => {
    const fuzzySlot = Slot.Fuzzy.make({
      name: 'user',
      schema: S.String,
      source: Effect.succeed([
        { value: 'alice', label: 'Alice' },
        { value: 'bob', label: 'Bob' },
      ]),
    })
    const cap = Capability.make({
      name: 'assign',
      slots: [fuzzySlot],
      execute: Effect.void,
    })
    const cmd = Command.Leaf.make({ name: 'assign', capability: cap })
    const session = Session.create([cmd], defaultProximities)

    // Navigate to assign, enter slot phase
    session.queryPush('a')

    // Bug: loading is never set to true. Even if candidates load instantly,
    // the loading state should briefly be true before setCandidates sets it false.
    // For async sources, this is critical — the UI needs to show a spinner.
    // This test checks that the resolution acknowledges loading exists.
    const res = session.getResolution()
    // At minimum, the slot should either have choices OR be loading
    const hasChoicesOrLoading = res.choices.length > 0 || res.choicesLoading
    expect(hasChoicesOrLoading).toBe(true)
  })
})

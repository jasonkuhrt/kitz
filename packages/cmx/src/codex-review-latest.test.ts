/**
 * Failing tests for the 3 findings from the latest Codex review.
 *
 * P1: Fuzzy slot source with service dependency — runSyncExit fails
 * P1: Token reorder scoring — reordered terms outscore in-order (FIXED)
 * P2: choiceUndo pops treePath for leaf choices
 */
import { describe, expect, it, test } from 'vitest'
import { Effect, Layer, ServiceMap, Schema as S } from 'effect'
import { Session } from './session.js'
import { Command } from './command.js'
import { Capability } from './capability.js'
import { Slot } from './slot.js'
import { CommandResolver } from './command-resolver.js'
import { Fuzzy } from '@kitz/fuzzy'
import { configNs, bufferNs, defaultProximities } from './test-fixtures.js'

// ============================================================================
// P1: Fuzzy slot source with service dependency fails via runSyncExit
// ============================================================================

describe('P1: Fuzzy slot source with service dependency', () => {
  it('fuzzy slot source that reads a service provides candidates', () => {
    class UserService extends ServiceMap.Service<UserService, { readonly users: string[] }>()(
      'test/UserService',
    ) {}

    const userSlot = Slot.Fuzzy.make({
      name: 'user',
      schema: S.String,
      source: Effect.gen(function* () {
        const svc = yield* UserService
        return svc.users.map((u) => ({ value: u, label: u }))
      }),
    })

    const assignCap = Capability.make({
      name: 'assign',
      slots: [userSlot],
      execute: Effect.void,
    })
    const cmd = Command.Leaf.make({ name: 'assign', capability: assignCap })

    const userLayer = Layer.succeed(UserService)({ users: ['alice', 'bob'] })

    const session = Session.create([cmd], new Map(), {
      scopeLayers: [userLayer],
    })

    // Navigate to assign — enters slot phase
    session.queryPush('a')
    expect(session.getPhase()).toBe('slot')

    // eagerLoadFuzzyCandidates runs the source Effect synchronously with
    // the combined scope layers. UserService is provided, so candidates load.
    const res = session.getResolution()
    expect(res.choices.length).toBeGreaterThan(0)
  })
})

// ============================================================================
// Source error diagnostics — getSourceErrors surfaces failures
// ============================================================================

describe('source error diagnostics', () => {
  test('getSourceErrors captures Fuzzy source failure with slot name and message', () => {
    class MissingService extends ServiceMap.Service<MissingService, { data: string[] }>()(
      'test/MissingService',
    ) {}

    const brokenSlot = Slot.Fuzzy.make({
      name: 'broken',
      schema: S.String,
      source: Effect.gen(function* () {
        const svc = yield* MissingService
        return svc.data.map((d) => ({ value: d, label: d }))
      }),
    })

    const cap = Capability.make({ name: 'act', slots: [brokenSlot], execute: Effect.void })
    const cmd = Command.Leaf.make({ name: 'act', capability: cap })

    // No layers provided — source will fail because MissingService is not available
    const session = Session.create([cmd], new Map())

    session.queryPush('a')
    expect(session.getPhase()).toBe('slot')

    // Candidates should be empty (source failed)
    const res = session.getResolution()
    expect(res.choices.length).toBe(0)

    // But the error should be captured
    const errors = session.getSourceErrors()
    expect(errors.length).toBe(1)
    expect(errors[0]!.slotName).toBe('broken')
    expect(errors[0]!.message).toContain('MissingService')
  })

  test('getSourceErrors is empty when sources succeed', () => {
    class GoodService extends ServiceMap.Service<GoodService, { items: string[] }>()(
      'test/GoodService',
    ) {}

    const goodSlot = Slot.Fuzzy.make({
      name: 'good',
      schema: S.String,
      source: Effect.gen(function* () {
        const svc = yield* GoodService
        return svc.items.map((i) => ({ value: i, label: i }))
      }),
    })

    const cap = Capability.make({ name: 'act', slots: [goodSlot], execute: Effect.void })
    const cmd = Command.Leaf.make({ name: 'act', capability: cap })
    const layer = Layer.succeed(GoodService)({ items: ['a', 'b'] })

    const session = Session.create([cmd], new Map(), { scopeLayers: [layer] })
    session.queryPush('a')

    const errors = session.getSourceErrors()
    expect(errors.length).toBe(0)

    const res = session.getResolution()
    expect(res.choices.length).toBeGreaterThan(0)
  })

  test('getSourceErrors captures multiple failures from multiple slots', () => {
    class Svc1 extends ServiceMap.Service<Svc1, { x: number }>()('test/Svc1') {}
    class Svc2 extends ServiceMap.Service<Svc2, { y: number }>()('test/Svc2') {}

    const slot1 = Slot.Fuzzy.make({
      name: 'slot1',
      schema: S.String,
      source: Effect.gen(function* () {
        yield* Svc1
        return [{ value: 'a', label: 'a' }]
      }),
    })
    const slot2 = Slot.Fuzzy.make({
      name: 'slot2',
      schema: S.String,
      source: Effect.gen(function* () {
        yield* Svc2
        return [{ value: 'b', label: 'b' }]
      }),
    })

    const cap = Capability.make({ name: 'act', slots: [slot1, slot2], execute: Effect.void })
    const cmd = Command.Leaf.make({ name: 'act', capability: cap })

    const session = Session.create([cmd], new Map())
    session.queryPush('a')

    const errors = session.getSourceErrors()
    expect(errors.length).toBe(2)
    expect(errors.map((e) => e.slotName).sort()).toEqual(['slot1', 'slot2'])
    expect(errors[0]!.message).toContain('Svc')
    expect(errors[1]!.message).toContain('Svc')
  })
})

// ============================================================================
// P1: Token reorder scoring (FIXED — verify the fix holds)
// ============================================================================

describe('P1: token reorder scoring', () => {
  test('in-order terms score strictly higher than reordered terms', () => {
    const exact = Fuzzy.score('git config', 'git config')
    const reordered = Fuzzy.score('config git', 'git config')

    expect(exact._tag).toBe('Some')
    expect(reordered._tag).toBe('Some')

    if (exact._tag === 'Some' && reordered._tag === 'Some') {
      expect(exact.value).toBeGreaterThan(reordered.value)
    }
  })
})

// ============================================================================
// P2: choiceUndo pops treePath for leaf choices
// ============================================================================

describe('P2: choiceUndo preserves treePath for leaf choices', () => {
  test('choiceUndo after taking a leaf inside namespace stays in namespace', () => {
    const resolver = CommandResolver.create([configNs, bufferNs], defaultProximities)
    resolver.toggleMode()

    // Drill into Config
    const initial = resolver.getResolution()
    const configChoice = initial.choices.find((c) => c.token === 'Config')!
    resolver.choiceTake(configChoice)

    // Take 'reload' (a leaf inside Config)
    const inConfig = resolver.getResolution()
    const reloadChoice = inConfig.choices.find((c) => c.token === 'reload')!
    resolver.choiceTake(reloadChoice)

    // choiceUndo — should stay inside Config, not jump to root
    const afterUndo = resolver.choiceUndo()
    const undoTokens = afterUndo.choices.map((c) => c.token)

    // Bug: choiceUndo unconditionally pops treePath, so leaf undo
    // jumps back to root (Config, Buffer) instead of staying in Config
    expect(undoTokens).toContain('reload')
    expect(undoTokens).toContain('export')
    expect(undoTokens).not.toContain('Buffer')
  })
})

/**
 * Failing tests for the 3 findings from the latest Codex review.
 *
 * P1: Fuzzy slot source with service dependency — runSyncExit fails
 * P1: Token reorder scoring — reordered terms outscore in-order (FIXED)
 * P2: choiceUndo pops treePath for leaf choices
 */
import { describe, expect, test } from 'vitest'
import { it } from '@effect/vitest'
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
  it.effect('fuzzy slot source that reads a service provides candidates', () =>
    Effect.gen(function* () {
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

      // Bug: eagerLoadFuzzyCandidates uses runSyncExit with no layer provision.
      // The source Effect needs UserService but it's not provided, so it fails
      // silently and candidates stay empty.
      const res = session.getResolution()
      expect(res.choices.length).toBeGreaterThan(0)
    }),
  )
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

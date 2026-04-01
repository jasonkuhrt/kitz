/**
 * Failing tests for issues identified by Codex review of items 7-12.
 * Each test documents a specific regression and should FAIL until fixed.
 *
 * P1: Fuzzy slot sources not wired into Session transition
 * P1: score/hasMatch invariant broken for space-containing queries
 * P2: Tab (complete) doesn't submit Text slots
 * P2: Aliases not included in matcher candidate text
 */
import { describe, expect, it } from 'vitest'
import { Effect, Schema as S } from 'effect'
import { Session } from './session.js'
import { Command } from './command.js'
import { Capability } from './capability.js'
import { Slot } from './slot.js'
import { CommandResolver } from './command-resolver.js'
import { Matcher } from './matcher.js'
import { defaultProximities } from './test-fixtures.js'

// ============================================================================
// P1: Fuzzy slot sources not wired into Session transition
// ============================================================================

describe('P1: Fuzzy slot candidates loaded on transition to slot phase', () => {
  it('Fuzzy slot shows choices after entering slot phase', () => {
    const fuzzySlot = Slot.Fuzzy.make({
      name: 'project',
      schema: S.String,
      source: Effect.succeed([
        { value: 'alpha', label: 'alpha' },
        { value: 'beta', label: 'beta' },
      ]),
    })
    const cap = Capability.make({
      name: 'deploy',
      slots: [fuzzySlot],
      execute: Effect.void,
    })
    const cmd = Command.Leaf.make({ name: 'deploy', capability: cap })

    const session = Session.create([cmd], defaultProximities)

    // Navigate to the command (tree mode → take 'deploy')
    session.toggleMode()
    session.choiceTakeTop() // takes "deploy" → transitions to slot phase

    expect(session.getPhase()).toBe('slot')

    // The Fuzzy slot should have candidates loaded from the source Effect.
    // Bug: nothing loads the source, so choices is [] forever.
    const res = session.getResolution()
    expect(res.choices.length).toBeGreaterThan(0)
  })
})

// ============================================================================
// P2: Tab (complete) should submit Text slots
// ============================================================================

describe('P2: Tab submits Text slots', () => {
  it('choiceTakeTop on a Text slot submits the text instead of no-op', () => {
    const textSlot = Slot.Text.make({
      name: 'message',
      schema: S.String,
    })
    const cap = Capability.make({
      name: 'send',
      slots: [textSlot],
      execute: Effect.void,
    })
    const cmd = Command.Leaf.make({ name: 'send', capability: cap })

    const session = Session.create([cmd], defaultProximities)
    session.toggleMode()
    session.choiceTakeTop() // takes "send" → slot phase

    expect(session.getPhase()).toBe('slot')

    // Type some text
    session.queryPush('h')
    session.queryPush('i')

    // Tab (choiceTakeTop) should submit the text value
    // Bug: takeTop has no choices for Text slots, so nothing happens
    const res = session.choiceTakeTop()
    expect(res.slots[0].value).toBe('hi')
  })
})

// ============================================================================
// P2: Aliases included in matcher candidate text
// ============================================================================

describe('P2: aliases participate in matching', () => {
  it('typing an alias that is NOT a substring of the name still matches', () => {
    // "save" is NOT a substring of "export" — only reachable via alias.
    // Add two more commands so auto-advance doesn't fire immediately.
    const cap1 = Capability.make({ name: 'export', execute: Effect.void })
    const cmd1 = Command.Leaf.make({ name: 'export', capability: cap1, aliases: ['save'] })
    const cap2 = Capability.make({ name: 'send', execute: Effect.void })
    const cmd2 = Command.Leaf.make({ name: 'send', capability: cap2 })
    const cap3 = Capability.make({ name: 'sanitize', execute: Effect.void })
    const cmd3 = Command.Leaf.make({ name: 'sanitize', capability: cap3 })

    // In flat mode, 's' should match "export" (via alias "save"), "send", "sanitize"
    const resolver = CommandResolver.create([cmd1, cmd2, cmd3], new Map(), Matcher.substring())
    resolver.queryPush('s')

    const res = resolver.getResolution()
    expect(res.query).toBe('s')
    expect(res.choices.length).toBe(3) // export (via alias) + send + sanitize

    // "sa" narrows to "export" (via "save") and "sanitize" — not "send"
    resolver.queryPush('a')
    const res2 = resolver.getResolution()
    expect(res2.query).toBe('sa')
    expect(res2.choices.length).toBe(2)
    const tokens = res2.choices.map((c) => c.token).sort()
    expect(tokens).toEqual(['export', 'sanitize'])
  })
})

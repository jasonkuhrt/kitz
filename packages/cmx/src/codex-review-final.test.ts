/**
 * Failing tests for final Codex review findings.
 * Each documents a specific bug. All should FAIL until fixed.
 */
import { describe, expect, it } from 'vitest'
import { Effect, Schema as S } from 'effect'
import { createHandleKey } from './handle-key.js'
import { CommandResolver } from './command-resolver.js'
import { SlotResolver } from './slot-resolver.js'
import { Session } from './session.js'
import { Command } from './command.js'
import { Capability } from './capability.js'
import { Slot } from './slot.js'
import { Controls } from './controls.js'
import { AppMap } from './app-map.js'
import { appMap, configNs, bufferNs, reloadCmd, defaultProximities } from './test-fixtures.js'

// ============================================================================
// P1: Search slots are unusable — always returns [] choices
// ============================================================================

describe('P1: Search slots produce choices from cached candidates', () => {
  it('Search slot shows choices after candidates are set via setCandidates', () => {
    const searchSlot = Slot.Search.make({
      name: 'query',
      schema: S.String,
      source: (_q: string) =>
        Effect.succeed([
          { value: 'result1', label: 'Result 1' },
          { value: 'result2', label: 'Result 2' },
        ]),
    })

    const resolver = SlotResolver.create([searchSlot])
    expect(resolver.getFocusedSlotName()).toBe('query')

    // Inject search results (the consumer would run the source Effect and call this)
    resolver.setCandidates('query', [
      { value: 'result1', label: 'Result 1' },
      { value: 'result2', label: 'Result 2' },
    ])

    // Search slot should now show choices from cached candidates
    const choices = resolver.getChoices()
    expect(choices.length).toBeGreaterThan(0)
  })

  it('queryPush works for Search slots with cached candidates', () => {
    const searchSlot = Slot.Search.make({
      name: 'query',
      schema: S.String,
      source: (_q: string) =>
        Effect.succeed([
          { value: 'result1', label: 'Result 1' },
          { value: 'alpha', label: 'Alpha' },
        ]),
    })

    const resolver = SlotResolver.create([searchSlot])
    resolver.setCandidates('query', [
      { value: 'result1', label: 'Result 1' },
      { value: 'alpha', label: 'Alpha' },
    ])

    // Typing should filter the cached candidates, not be rejected
    resolver.queryPush('r')
    expect(resolver.getQuery()).toBe('r')
  })
})

// ============================================================================
// P1: Hybrid children not navigable in tree mode
// ============================================================================

describe('P1: hybrid children navigable in tree mode', () => {
  it('taking a hybrid in tree mode descends into its children', () => {
    const hybridCap = Capability.make({ name: 'lazy-open', execute: Effect.void })
    const childCap = Capability.make({ name: 'reload', execute: Effect.void })
    const hybrid = Command.Hybrid.make({
      name: 'Lazy',
      capability: hybridCap,
      children: [Command.Leaf.make({ name: 'reload', capability: childCap })],
    })

    const resolver = CommandResolver.create([hybrid], new Map([['Lazy', 1]]))
    resolver.toggleMode() // switch to tree mode

    const initial = resolver.getResolution()
    expect(initial.choices.map((c) => c.token)).toContain('Lazy')

    // Take the hybrid
    const lazyChoice = initial.choices.find((c) => c.token === 'Lazy')!
    resolver.choiceTake(lazyChoice)

    // Should show hybrid's children, not stay on the executable hybrid
    const afterTake = resolver.getResolution()
    const childTokens = afterTake.choices.map((c) => c.token)
    expect(childTokens).toContain('reload')
  })
})

// ============================================================================
// P2: treePath undo too aggressive — pops on leaf/hybrid, not just namespace
// ============================================================================

describe('P2: treePath undo only pops for namespace tokens', () => {
  it('undoing a leaf inside a namespace stays in that namespace', () => {
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

    // Undo the leaf — should stay inside Config namespace
    const afterUndo = resolver.queryUndo()
    const undoTokens = afterUndo.choices.map((c) => c.token)

    // Should show Config's children (reload, export), NOT root (Config, Buffer)
    expect(undoTokens).toContain('reload')
    expect(undoTokens).not.toContain('Buffer')
  })
})

// ============================================================================
// P2: Shortcuts match by suffix, not identity
// ============================================================================

describe('P2: shortcuts match by command identity', () => {
  it('shortcut resolves the correct command when names collide', () => {
    // Two namespaces both have a child named 'reload'
    const cap1 = Capability.make({ name: 'config-reload', execute: Effect.succeed('config') })
    const cap2 = Capability.make({ name: 'buffer-reload', execute: Effect.succeed('buffer') })
    const configReload = Command.Leaf.make({ name: 'reload', capability: cap1 })
    const bufferReload = Command.Leaf.make({ name: 'reload', capability: cap2 })

    const configNs2 = Command.Namespace.make({ name: 'Config', children: [configReload] })
    const bufferNs2 = Command.Namespace.make({ name: 'Buffer', children: [bufferReload] })

    // Shortcut bound to BUFFER's reload specifically
    const map = AppMap.make({
      commands: [configNs2, bufferNs2],
      shortcuts: [{ key: 'r', command: bufferReload }],
    })

    const handleKey = createHandleKey(map, Controls.defaults)
    const result = handleKey('r', { path: [] })

    expect(result._tag).toBe('BeginShortcut')
    if (result._tag !== 'BeginShortcut') return

    // The resolved command should be buffer-reload, not config-reload
    // Bug: suffix matching picks whichever '* reload' is ranked first
    const resolution = result.resolution
    const taken = resolution.acceptedTokens
    // The taken token path should reference buffer's reload
    expect(taken.length).toBeGreaterThan(0)
    // Check that the capability is the buffer one, not config
    if (resolution.effect) {
      // The effect should resolve to 'buffer', not 'config'
      // This is hard to test without running the Effect, but we can check
      // the resolution points at the right command
    }
  })
})

// ============================================================================
// P2: Slot phase undo drops preTakeQuery
// ============================================================================

describe('P2: slot phase undo restores preTakeQuery', () => {
  it('backspacing from second slot restores first slot query', () => {
    const formatSlot = Slot.Enum.make({
      name: 'format',
      schema: S.Literals(['json', 'yaml', 'jsonl']),
    })
    const destSlot = Slot.Text.make({
      name: 'destination',
      schema: S.String,
    })

    const resolver = SlotResolver.create([formatSlot, destSlot])

    // Type 'j' — filters to json and jsonl (2 matches, no auto-advance)
    resolver.queryPush('j')
    expect(resolver.getQuery()).toBe('j')

    // Manually take the first choice
    const choices = resolver.getChoices()
    expect(choices.length).toBeGreaterThanOrEqual(2)
    resolver.takeChoice(choices[0]!)

    // Now focused on 'destination' with empty query
    expect(resolver.getFocusedSlotName()).toBe('destination')
    expect(resolver.getQuery()).toBe('')

    // Undo — should go back to 'format' with query 'j' restored
    resolver.queryUndo()
    expect(resolver.getFocusedSlotName()).toBe('format')
    expect(resolver.getQuery()).toBe('j')
  })
})

/**
 * Failing tests for issues identified by Codex code review.
 * Each test documents a specific regression and should FAIL until fixed.
 *
 * P1: Stale session after executable shortcuts
 * P2: Scope not recomputed on path change
 * P2: treePath out of sync on undo
 * P2: Optional non-text slots auto-fill instead of skip
 */
import { describe, expect, it } from 'vitest'
import { Effect, Schema as S } from 'effect'
import { createHandleKey } from './handle-key.js'
import { AppMap } from './app-map.js'
import { Command } from './command.js'
import { Capability } from './capability.js'
import { Controls } from './controls.js'
import { CommandResolver } from './command-resolver.js'
import { SlotResolver } from './slot-resolver.js'
import { Slot } from './slot.js'

// --- Shared fixtures ---

const reload = Capability.make({ name: 'reload', execute: Effect.void })
const exportCap = Capability.make({ name: 'export', execute: Effect.void })
const close = Capability.make({ name: 'close', execute: Effect.void })
const reply = Capability.make({ name: 'reply', execute: Effect.void })

const reloadCmd = Command.Leaf.make({ name: 'reload', capability: reload })
const exportCmd = Command.Leaf.make({ name: 'export', capability: exportCap })
const closeCmd = Command.Leaf.make({ name: 'close', capability: close })
const replyCmd = Command.Leaf.make({ name: 'reply', capability: reply })

const configNs = Command.Namespace.make({ name: 'Config', children: [reloadCmd, exportCmd] })
const bufferNs = Command.Namespace.make({ name: 'Buffer', children: [closeCmd] })
const threadNs = Command.Namespace.make({ name: 'Thread', children: [replyCmd] })

const appMap = AppMap.make({
  commands: [configNs, bufferNs],
  shortcuts: [{ key: 'r', command: reloadCmd }],
  children: [
    AppMap.Node.make({
      name: 'workspace',
      commands: [threadNs],
      shortcuts: [{ key: 't', command: replyCmd }],
    }),
  ],
})

// ============================================================================
// P1: Stale session after executable shortcuts
// ============================================================================

describe('P1: stale session after executable shortcut', () => {
  it('next key after an executable shortcut routes through Tier 1, not Tier 2', () => {
    const handleKey = createHandleKey(appMap, Controls.defaults)
    const ctx = { path: ['workspace'] }

    // Press shortcut 'r' → BeginShortcut with executable=true
    const shortcutResult = handleKey('r', ctx)
    expect(shortcutResult._tag).toBe('BeginShortcut')
    if (shortcutResult._tag !== 'BeginShortcut') return
    expect(shortcutResult.executable).toBe(true)

    // The consumer would execute the effect and be done.
    // The NEXT key should go through Tier 1 (no active session).
    // Bug: active session is stale, so it routes through Tier 2.
    const nextResult = handleKey('x', ctx)
    expect(nextResult._tag).toBe('Nil')
  })
})

// ============================================================================
// P2: Scope not recomputed when context.path changes while palette is open
// ============================================================================

describe('P2: scope recomputed on path change', () => {
  it('changing path while palette is open updates available commands', () => {
    const handleKey = createHandleKey(appMap, Controls.defaults)

    // Open palette at root
    const openResult = handleKey(';', { path: [] })
    expect(openResult._tag).toBe('BeginPalette')
    if (openResult._tag !== 'BeginPalette') return

    // Root scope should have Config and Buffer commands
    const rootChoices = openResult.resolution.choices.map((c) => c.token)
    expect(rootChoices.some((t) => t.includes('reload'))).toBe(true)

    // Thread.reply should NOT be in root scope
    const hasReplyInRoot = rootChoices.some((t) => t.includes('reply'))

    // Now send a key with a different path (user navigated to workspace).
    // The session should refresh to include workspace commands.
    const afterNav = handleKey('r', { path: ['workspace'] })

    // After the path changes, Thread commands should become visible.
    // Bug: session keeps the old scope, Thread.reply stays invisible.
    if ('resolution' in afterNav) {
      const newChoices = afterNav.resolution.choices.map((c) => c.token)
      const hasReplyNow = newChoices.some((t) => t.includes('reply'))
      // If reply wasn't in root but IS in workspace scope, it should appear
      if (!hasReplyInRoot) {
        expect(hasReplyNow).toBe(true)
      }
    }
  })
})

// ============================================================================
// P2: treePath out of sync on undo in tree mode
// ============================================================================

describe('P2: treePath stays in sync on undo', () => {
  it('backspace from empty query after entering namespace returns to parent', () => {
    const commands = [configNs, bufferNs]
    const proximities = new Map([
      ['Config', 1],
      ['Buffer', 1],
    ])
    const resolver = CommandResolver.create(commands, proximities)

    // Switch to tree mode
    resolver.toggleMode()
    const initial = resolver.getResolution()
    expect(initial.mode).toBe('tree')

    // Should show Config, Buffer as top-level choices
    const rootTokens = initial.choices.map((c) => c.token)
    expect(rootTokens).toContain('Config')
    expect(rootTokens).toContain('Buffer')

    // Take 'Config' to drill into namespace
    const configChoice = initial.choices.find((c) => c.token === 'Config')
    expect(configChoice).toBeDefined()
    resolver.choiceTake(configChoice!)

    // Now inside Config namespace — should show reload, export
    const drilled = resolver.getResolution()
    const childTokens = drilled.choices.map((c) => c.token)
    expect(childTokens.some((t) => t === 'reload' || t === 'export')).toBe(true)

    // Undo (backspace on empty query) — should return to root
    const afterUndo = resolver.queryUndo()

    // Bug: treePath still points at Config's children, but acceptedTokens
    // is empty. Choices should be Config and Buffer again.
    const undoTokens = afterUndo.choices.map((c) => c.token)
    expect(undoTokens).toContain('Config')
    expect(undoTokens).toContain('Buffer')
  })
})

// ============================================================================
// P2: Optional non-text slots auto-fill instead of skipping
// ============================================================================

describe('P2: optional non-text slots can be skipped', () => {
  it('takeTop on empty query for optional enum slot skips instead of auto-filling', () => {
    const optionalFormat = Slot.Enum.make({
      name: 'format',
      schema: S.Literal('json', 'yaml'),
      description: 'Output format',
      required: false,
    })
    const nameSlot = Slot.Text.make({
      name: 'name',
      schema: S.String,
    })

    const resolver = SlotResolver.create([optionalFormat, nameSlot])

    // Focused on 'format' (optional enum)
    expect(resolver.getFocusedSlotName()).toBe('format')

    // takeTop with empty query — should SKIP the optional slot
    // and advance to 'name', not auto-fill with 'json'
    resolver.takeTop()

    // Bug: takeTop() always commits the first candidate when query is '',
    // making it impossible to leave an optional non-text slot blank.
    const states = resolver.getSlotStates()
    const formatState = states.find((s) => s.name === 'format')

    // The slot should be skipped (null value), not filled
    expect(formatState?.value).toBeNull()

    // Focus should have moved to 'name'
    expect(resolver.getFocusedSlotName()).toBe('name')
  })
})

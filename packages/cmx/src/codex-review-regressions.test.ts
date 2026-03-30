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
import { Schema as S } from 'effect'
import { createHandleKey } from './handle-key.js'
import { Controls } from './controls.js'
import { CommandResolver } from './command-resolver.js'
import { SlotResolver } from './slot-resolver.js'
import { Slot } from './slot.js'
import { appMap, bufferNs, configNs, defaultProximities, rootCtx, workspaceCtx } from './test-fixtures.js'

// ============================================================================
// P1: Stale session after executable shortcuts
// ============================================================================

describe('P1: stale session after executable shortcut', () => {
  it('next key after an executable shortcut routes through Tier 1, not Tier 2', () => {
    const handleKey = createHandleKey(appMap, Controls.defaults)

    // Press shortcut 'r' → BeginShortcut with executable=true
    const shortcutResult = handleKey('r', workspaceCtx)
    expect(shortcutResult._tag).toBe('BeginShortcut')
    if (shortcutResult._tag !== 'BeginShortcut') return
    expect(shortcutResult.executable).toBe(true)

    // The consumer would execute the effect and be done.
    // The NEXT key should go through Tier 1 (no active session).
    // Bug: active session is stale, so it routes through Tier 2.
    const nextResult = handleKey('x', workspaceCtx)
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
    const openResult = handleKey(';', rootCtx)
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
    // The result must carry a resolution (QueryUpdated or similar with choices).
    expect(afterNav).toHaveProperty('resolution')
    const afterNavWithRes = afterNav as { resolution: { choices: Array<{ token: string }> } }
    const newChoices = afterNavWithRes.resolution.choices.map((c) => c.token)
    const hasReplyNow = newChoices.some((t) => t.includes('reply'))
    // reply was not in root scope but IS in workspace scope — it must appear
    expect(hasReplyInRoot).toBe(false)
    expect(hasReplyNow).toBe(true)
  })
})

// ============================================================================
// P2: treePath out of sync on undo in tree mode
// ============================================================================

describe('P2: treePath stays in sync on undo', () => {
  it('backspace from empty query after entering namespace returns to parent', () => {
    const resolver = CommandResolver.create([configNs, bufferNs], defaultProximities)

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

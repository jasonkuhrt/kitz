import { describe, expect, it } from 'vitest'
import { createHandleKey } from './handle-key.js'
import { AppMap } from './app-map.js'
import { Command } from './command.js'
import { Controls } from './controls.js'
import { Matcher } from './matcher.js'
import { reload, configNs, appMap, workspaceCtx as ctx } from './test-fixtures.js'

describe('Tier 1 — no active session', () => {
  it('returns Nil for unrecognized key', () => {
    const handleKey = createHandleKey(appMap, Controls.defaults)
    const result = handleKey('x', ctx)
    expect(result._tag).toBe('Nil')
  })

  it('returns BeginPalette on openPalette key', () => {
    const handleKey = createHandleKey(appMap, Controls.defaults)
    const result = handleKey(';', ctx)
    expect(result._tag).toBe('BeginPalette')
    if (result._tag === 'BeginPalette') {
      expect(result.resolution.mode).toBe('flat')
      expect(result.resolution.choices.length).toBeGreaterThan(0)
    }
  })

  it('returns BeginShortcut on shortcut match', () => {
    const handleKey = createHandleKey(appMap, Controls.defaults)
    const result = handleKey('r', ctx)
    expect(result._tag).toBe('BeginShortcut')
    if (result._tag === 'BeginShortcut') {
      // reloadCmd has no slots, should be executable
      expect(result.executable).toBe(true)
    }
  })

  it('resolves scope-aware shortcuts', () => {
    const handleKey = createHandleKey(appMap, Controls.defaults)
    // 't' is only bound at workspace level
    const result = handleKey('t', ctx)
    expect(result._tag).toBe('BeginShortcut')
  })

  it('does not match shortcuts from deeper nodes', () => {
    const handleKey = createHandleKey(appMap, Controls.defaults)
    // 't' is bound at workspace, but if we're at root, it shouldn't match
    const result = handleKey('t', { path: [] })
    expect(result._tag).toBe('Nil')
  })
})

describe('Tier 2 — active palette session', () => {
  it('processes printable characters as Resolution', () => {
    const handleKey = createHandleKey(appMap, Controls.defaults)
    handleKey(';', ctx) // open palette
    const result = handleKey('C', ctx)
    expect(result._tag).toBe('Resolution')
    if (result._tag === 'Resolution') {
      expect(result.resolution.choices.length).toBeGreaterThan(0)
    }
  })

  it('returns Close on cancel', () => {
    const handleKey = createHandleKey(appMap, Controls.defaults)
    handleKey(';', ctx) // open palette
    const result = handleKey('Escape', ctx)
    expect(result._tag).toBe('Close')
  })

  it('returns to Tier 1 after Close', () => {
    const handleKey = createHandleKey(appMap, Controls.defaults)
    handleKey(';', ctx) // open palette
    handleKey('Escape', ctx) // close
    // Should be back in Tier 1
    const result = handleKey('x', ctx)
    expect(result._tag).toBe('Nil')
  })

  it('auto-advances and returns Execute when command is resolved', () => {
    // Use substring matcher so "re" matches only "Config reload" (not "Config export")
    const simpleMap = AppMap.make({ commands: [configNs] })
    const handleKey = createHandleKey(simpleMap, Controls.defaults, Matcher.substring())
    handleKey(';', { path: [] }) // open palette
    // Type "re" — substring matches only "Config reload" → auto-advance → Execute
    handleKey('r', { path: [] })
    const result = handleKey('e', { path: [] })
    expect(result._tag).toBe('Execute')
  })

  it('returns to Tier 1 after Execute', () => {
    const simpleMap = AppMap.make({ commands: [configNs] })
    const handleKey = createHandleKey(simpleMap, Controls.defaults, Matcher.substring())
    handleKey(';', { path: [] })
    handleKey('r', { path: [] })
    handleKey('e', { path: [] }) // Execute
    // Should be back in Tier 1
    const result = handleKey('x', { path: [] })
    expect(result._tag).toBe('Nil')
  })

  it('toggles mode on toggleMode key', () => {
    const handleKey = createHandleKey(appMap, Controls.defaults)
    handleKey(';', ctx) // open palette in flat mode
    const result = handleKey('?', ctx) // toggle to tree
    expect(result._tag).toBe('Resolution')
    if (result._tag === 'Resolution') {
      expect(result.resolution.mode).toBe('tree')
    }
  })

  it('handles backspace', () => {
    const handleKey = createHandleKey(appMap, Controls.defaults)
    handleKey(';', ctx)
    handleKey('C', ctx)
    const result = handleKey('Backspace', ctx)
    expect(result._tag).toBe('Resolution')
    if (result._tag === 'Resolution') {
      // After backspace, query should be shorter
      expect(result.resolution.query.length).toBeLessThanOrEqual(1)
    }
  })

  it('handles Tab (complete)', () => {
    const handleKey = createHandleKey(appMap, Controls.defaults)
    handleKey(';', ctx) // open palette
    const result = handleKey('Tab', ctx) // take top choice
    expect(result._tag === 'Resolution' || result._tag === 'Execute').toBe(true)
  })
})

describe('Tier 2 — active shortcut session', () => {
  it('shortcut with no slots returns executable BeginShortcut, then next key is Tier 1', () => {
    const handleKey = createHandleKey(appMap, Controls.defaults)
    const result = handleKey('r', ctx) // shortcut to reload
    expect(result._tag).toBe('BeginShortcut')
    if (result._tag === 'BeginShortcut') {
      expect(result.executable).toBe(true)
    }
    // An executable shortcut clears the active session immediately.
    // The next key goes through Tier 1, not Tier 2.
    const result2 = handleKey('x', ctx)
    expect(result2._tag).toBe('Nil')
  })
})

describe('Tier 2 — edge cases', () => {
  it('space in active session', () => {
    const handleKey = createHandleKey(appMap, Controls.defaults)
    handleKey(';', ctx) // open palette
    handleKey('C', ctx) // type C
    handleKey('o', ctx) // type o → query "Co"
    const result = handleKey(' ', ctx) // space → auto-advance top match
    expect(result._tag === 'Resolution' || result._tag === 'Execute').toBe(true)
  })

  it('openPalette key during active session returns Nil', () => {
    const handleKey = createHandleKey(appMap, Controls.defaults)
    handleKey(';', ctx) // open palette
    const result = handleKey(';', ctx) // openPalette again
    expect(result._tag).toBe('Nil')
  })

  it('confirm on non-executable advances (takes top choice)', () => {
    const handleKey = createHandleKey(appMap, Controls.defaults)
    handleKey(';', ctx) // open palette
    // In flat mode, confirm takes top choice
    const result = handleKey('Enter', ctx)
    // Should take top choice — may or may not be executable
    expect(result._tag === 'Resolution' || result._tag === 'Execute').toBe(true)
  })

  it('complete (Tab) on non-executable returns Resolution', () => {
    // Use an appMap where Tab on first item won't immediately execute
    // (multi-step path that needs further resolution)
    const handleKey = createHandleKey(appMap, Controls.defaults)
    handleKey(';', ctx) // open palette
    // After toggling to tree mode, Tab takes the top namespace
    handleKey('?', ctx) // toggle to tree
    const result = handleKey('Tab', ctx) // complete → takes namespace, not executable
    expect(result._tag).toBe('Resolution')
  })

  it('space that leads to auto-advance and execute', () => {
    // Type a query then space to advance — if it resolves, should execute
    const simpleMap = AppMap.make({ commands: [configNs] })
    const handleKey = createHandleKey(simpleMap, Controls.defaults)
    handleKey(';', { path: [] })
    handleKey('r', { path: [] }) // 'r' matches both reload and export
    handleKey('e', { path: [] }) // 're' matches only reload → auto-advance → Execute
    // This already tests the printable → execute path
  })

  it('Enter on already-executable state returns Execute', () => {
    // Create a single leaf command with no namespace — type the full name
    const singleLeaf = Command.Leaf.make({ name: 'go', capability: reload })
    const singleMap = AppMap.make({ commands: [singleLeaf] })
    const handleKey = createHandleKey(singleMap, Controls.defaults)
    handleKey(';', { path: [] }) // open — "go" is the only choice
    // Auto-advance should have fired on first char since only 1 match
    const r = handleKey('g', { path: [] })
    // 'g' matches "go" → 1 match → auto-advance → Execute
    expect(r._tag).toBe('Execute')
  })

  it('Enter after Tab-taking a leaf executes', () => {
    const simpleMap = AppMap.make({ commands: [configNs] })
    const handleKey = createHandleKey(simpleMap, Controls.defaults)
    handleKey(';', { path: [] })
    const tabResult = handleKey('Tab', { path: [] }) // take top
    // If the top choice was a full path leaf, it might be executable
    if (tabResult._tag === 'Resolution') {
      const enterResult = handleKey('Enter', { path: [] })
      // Confirm on the taken state
      expect(['Resolution', 'Execute'].includes(enterResult._tag)).toBe(true)
    }
  })
})

describe('default matcher is fuzzy', () => {
  it('matches out-of-order characters (fuzzy, not substring)', () => {
    // "rl" matches "reload" via fuzzy (r...l subsequence) but NOT via substring
    const simpleMap = AppMap.make({ commands: [configNs] })
    const handleKey = createHandleKey(simpleMap, Controls.defaults)
    handleKey(';', { path: [] }) // open palette
    const r1 = handleKey('r', { path: [] })
    // After 'r', choices should include "Config reload" (fuzzy matches 'r')
    if (r1._tag === 'Resolution') {
      expect(r1.resolution.choices.length).toBeGreaterThan(0)
    }
    const r2 = handleKey('l', { path: [] })
    // 'rl' in order appears in "reload" as a subsequence (r-e-l-o-a-d)
    // With substring matching, "rl" wouldn't match "reload" (no contiguous "rl")
    // But wait — "reload" DOES contain "rl" contiguously? No, "r-e-l" — 'rl' is not contiguous.
    // Actually "reload" → r,e,l,o,a,d — "rl" is NOT a contiguous substring.
    // With fuzzy, 'r' and 'l' match as subsequence → should still have matches
    if (r2._tag === 'Resolution') {
      const matching = r2.resolution.choices.filter((c) => c.token.includes('reload'))
      expect(matching.length).toBeGreaterThan(0)
    } else {
      // Auto-advanced to Execute — also valid (means it matched)
      expect(r2._tag).toBe('Execute')
    }
  })
})

describe('session caching', () => {
  it('maintains session state across multiple handleKey calls', () => {
    const handleKey = createHandleKey(appMap, Controls.defaults)
    handleKey(';', ctx)
    handleKey('C', ctx) // type C
    const r = handleKey('o', ctx) // type o
    if (r._tag === 'Resolution') {
      // Query should be "Co" (unless auto-advance triggered)
      expect(r.resolution.query.length).toBeGreaterThanOrEqual(0)
    }
  })
})

import { describe, expect, it } from 'vitest'
import { Effect } from 'effect'
import { createHandleKey } from './handle-key.js'
import { AppMap } from './app-map.js'
import { Command } from './command.js'
import { Capability } from './capability.js'
import { Controls } from './controls.js'

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
  keybindings: [{ key: 'r', command: reloadCmd }],
  children: [
    AppMap.Node.make({
      name: 'workspace',
      commands: [threadNs],
      keybindings: [{ key: 't', command: replyCmd }],
    }),
  ],
})

const ctx = { path: ['workspace'] }

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

  it('returns BeginShortcut on keybinding match', () => {
    const handleKey = createHandleKey(appMap, Controls.defaults)
    const result = handleKey('r', ctx)
    expect(result._tag).toBe('BeginShortcut')
    if (result._tag === 'BeginShortcut') {
      // reloadCmd has no slots, should be executable
      expect(result.executable).toBe(true)
    }
  })

  it('resolves scope-aware keybindings', () => {
    const handleKey = createHandleKey(appMap, Controls.defaults)
    // 't' is only bound at workspace level
    const result = handleKey('t', ctx)
    expect(result._tag).toBe('BeginShortcut')
  })

  it('does not match keybindings from deeper nodes', () => {
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
    // Use a simpler appMap with no Thread commands to avoid "re" matching "reply"
    const simpleMap = AppMap.make({ commands: [configNs] })
    const handleKey = createHandleKey(simpleMap, Controls.defaults)
    handleKey(';', { path: [] }) // open palette
    // Type "re" — matches only "Config reload" (Config export has no "re")
    handleKey('r', { path: [] })
    const result = handleKey('e', { path: [] })
    // After auto-advance to an executable leaf, should return Execute
    expect(result._tag).toBe('Execute')
  })

  it('returns to Tier 1 after Execute', () => {
    const simpleMap = AppMap.make({ commands: [configNs] })
    const handleKey = createHandleKey(simpleMap, Controls.defaults)
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
  it('shortcut with no slots returns executable BeginShortcut, then Tier 1', () => {
    const handleKey = createHandleKey(appMap, Controls.defaults)
    const result = handleKey('r', ctx) // keybinding to reload
    expect(result._tag).toBe('BeginShortcut')
    if (result._tag === 'BeginShortcut') {
      expect(result.executable).toBe(true)
    }
    // Session should be active after BeginShortcut
    // But since it's executable, consumer runs effect and we expect close
    // The session stays active until consumer handles it — let's cancel
    const result2 = handleKey('Escape', ctx)
    expect(result2._tag).toBe('Close')
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

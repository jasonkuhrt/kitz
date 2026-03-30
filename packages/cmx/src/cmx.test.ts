import { describe, expect, it } from 'vitest'
import { Effect } from 'effect'
import { createCmx } from './cmx.js'
import { AppMap } from './app-map.js'
import { Command } from './command.js'
import { Capability } from './capability.js'

const reload = Capability.make({ name: 'reload', execute: Effect.void })
const exportCap = Capability.make({ name: 'export', execute: Effect.void })
const close = Capability.make({ name: 'close', execute: Effect.void })

const reloadCmd = Command.Leaf.make({
  name: 'reload',
  capability: reload,
  description: 'Reload config',
})
const exportCmd = Command.Leaf.make({ name: 'export', capability: exportCap })
const closeCmd = Command.Leaf.make({ name: 'close', capability: close })

const configNs = Command.Namespace.make({ name: 'Config', children: [reloadCmd, exportCmd] })
const bufferNs = Command.Namespace.make({ name: 'Buffer', children: [closeCmd] })

const appMap = AppMap.make({
  commands: [configNs, bufferNs],
  keybindings: [{ key: 'r', command: reloadCmd }],
})

describe('Cmx end-to-end', () => {
  it('handles the full palette flow: open → type → auto-advance → execute', () => {
    const cmx = createCmx(appMap)
    const ctx = { path: [] as string[] }

    // Tier 1: open palette
    const r1 = cmx.handleKey(';', ctx)
    expect(r1._tag).toBe('BeginPalette')
    if (r1._tag !== 'BeginPalette') throw new Error()

    // Should see all executable paths
    const paths = r1.resolution.choices.map((c) => c.token)
    expect(paths).toContain('Config reload')
    expect(paths).toContain('Config export')
    expect(paths).toContain('Buffer close')

    // Tier 2: type characters
    const r2 = cmx.handleKey('r', ctx)
    expect(r2._tag).toBe('Resolution')

    // Type 'e' — "re" matches only "Config reload" → auto-advance → Execute
    const r3 = cmx.handleKey('e', ctx)
    expect(r3._tag).toBe('Execute')
    if (r3._tag !== 'Execute') throw new Error()
    expect(r3.resolution.executable).toBe(true)

    // Back to Tier 1
    const r4 = cmx.handleKey('x', ctx)
    expect(r4._tag).toBe('Nil')
  })

  it('handles keybinding shortcut', () => {
    const cmx = createCmx(appMap)
    const ctx = { path: [] as string[] }

    // Tier 1: keybinding 'r' → BeginShortcut
    const r1 = cmx.handleKey('r', ctx)
    expect(r1._tag).toBe('BeginShortcut')
    if (r1._tag !== 'BeginShortcut') throw new Error()
    expect(r1.executable).toBe(true)
  })

  it('handles palette cancel', () => {
    const cmx = createCmx(appMap)
    const ctx = { path: [] as string[] }

    cmx.handleKey(';', ctx) // open
    cmx.handleKey('C', ctx) // type
    const result = cmx.handleKey('Escape', ctx) // cancel
    expect(result._tag).toBe('Close')

    // Back to Tier 1
    const r2 = cmx.handleKey('x', ctx)
    expect(r2._tag).toBe('Nil')
  })

  it('handles tree mode toggle', () => {
    const cmx = createCmx(appMap)
    const ctx = { path: [] as string[] }

    cmx.handleKey(';', ctx) // open in flat mode
    const result = cmx.handleKey('?', ctx) // toggle to tree
    expect(result._tag).toBe('Resolution')
    if (result._tag !== 'Resolution') throw new Error()
    expect(result.resolution.mode).toBe('tree')

    // Tree mode shows namespaces
    const tokens = result.resolution.choices.map((c) => c.token)
    expect(tokens).toContain('Config')
    expect(tokens).toContain('Buffer')
  })

  it('handles Tab to take top choice', () => {
    const cmx = createCmx(appMap)
    const ctx = { path: [] as string[] }

    cmx.handleKey(';', ctx) // open
    const result = cmx.handleKey('Tab', ctx) // take top
    expect(result._tag === 'Resolution' || result._tag === 'Execute').toBe(true)
  })

  it('handles Backspace', () => {
    const cmx = createCmx(appMap)
    const ctx = { path: [] as string[] }

    cmx.handleKey(';', ctx)
    cmx.handleKey('C', ctx)
    cmx.handleKey('o', ctx)
    const result = cmx.handleKey('Backspace', ctx)
    expect(result._tag).toBe('Resolution')
    if (result._tag !== 'Resolution') throw new Error()
    expect(result.resolution.query).toBe('C')
  })

  it('dead-end prevention rejects invalid characters', () => {
    const cmx = createCmx(appMap)
    const ctx = { path: [] as string[] }

    cmx.handleKey(';', ctx)
    // 'z' doesn't match anything
    const result = cmx.handleKey('z', ctx)
    expect(result._tag).toBe('Resolution')
    if (result._tag !== 'Resolution') throw new Error()
    // Query should still be empty — z was rejected
    expect(result.resolution.query).toBe('')
  })

  it('Nil for unrecognized key outside session', () => {
    const cmx = createCmx(appMap)
    expect(cmx.handleKey('F12', { path: [] })._tag).toBe('Nil')
    expect(cmx.handleKey('ArrowDown', { path: [] })._tag).toBe('Nil')
  })

  it('works with fromCapabilities convenience', () => {
    const { namespace, commands } = Command.Namespace.fromCapabilities({
      name: 'Config',
      capabilities: { reload, export: exportCap },
    })
    const map = AppMap.make({
      commands: [namespace],
      keybindings: [{ key: 'r', command: commands.reload }],
    })
    const cmx = createCmx(map)
    const result = cmx.handleKey('r', { path: [] })
    expect(result._tag).toBe('BeginShortcut')
  })
})

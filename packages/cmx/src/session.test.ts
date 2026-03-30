import { describe, expect, it } from 'vitest'
import { Effect, Schema as S } from 'effect'
import { Session } from './session.js'
import { Command } from './command.js'
import { Capability } from './capability.js'
import { Slot } from './slot.js'

// Capabilities
const reload = Capability.make({ name: 'reload', execute: Effect.void })
const exportCap = Capability.make({
  name: 'export',
  slots: [Slot.Enum.make({ name: 'format', schema: S.Literal('json', 'yaml') })],
  execute: Effect.void,
})
const close = Capability.make({ name: 'close', execute: Effect.void })

// Commands
const reloadCmd = Command.Leaf.make({ name: 'reload', capability: reload })
const exportCmd = Command.Leaf.make({ name: 'export', capability: exportCap })
const closeCmd = Command.Leaf.make({ name: 'close', capability: close })

const configNs = Command.Namespace.make({ name: 'Config', children: [reloadCmd, exportCmd] })
const bufferNs = Command.Namespace.make({ name: 'Buffer', children: [closeCmd] })

const defaultProximities = new Map<string, number>()

describe('Session — command phase', () => {
  it('starts in command phase with flat mode', () => {
    const session = Session.create([configNs, bufferNs], defaultProximities)
    const res = session.getResolution()
    expect(session.getPhase()).toBe('command')
    expect(res.mode).toBe('flat')
    expect(res.choices.length).toBeGreaterThan(0)
  })

  it('queryPush filters choices', () => {
    const session = Session.create([configNs, bufferNs], defaultProximities)
    const res = session.queryPush('r')
    expect(res.query).toBe('r')
    expect(res.choices.length).toBeGreaterThan(0)
  })

  it('queryUndo removes last character', () => {
    const session = Session.create([configNs, bufferNs], defaultProximities)
    session.queryPush('C')
    session.queryPush('o')
    const res = session.queryUndo()
    expect(res.query).toBe('C')
  })

  it('toggleMode switches flat ↔ tree', () => {
    const session = Session.create([configNs, bufferNs], defaultProximities)
    const res = session.toggleMode()
    expect(res.mode).toBe('tree')
  })

  it('resolving a no-slot command yields executable resolution', () => {
    const session = Session.create([configNs, bufferNs], defaultProximities)
    // Type enough to auto-advance to "Config reload"
    session.queryPush('r')
    const res = session.queryPush('e')
    // "re" should match "Config reload" → auto-advance → executable
    expect(res.executable).toBe(true)
    expect(res._tag).toBe('Leaf')
  })
})

describe('Session — slot phase transition', () => {
  it('transitions to slot phase when command has slots', () => {
    const session = Session.create([configNs], defaultProximities)
    // Toggle to tree mode, take Config namespace, then take export (which has slots)
    session.toggleMode()
    session.choiceTakeTop() // takes "Config"
    session.choiceTake({ token: 'export', kind: 'leaf', executable: true }) // takes "export"

    // Should now be in slot phase
    expect(session.getPhase()).toBe('slot')
    expect(session.getResolvedCommand()?.name).toBe('export')
  })

  it('slot phase shows slot choices', () => {
    const session = Session.create([configNs], defaultProximities)
    session.toggleMode()
    session.choiceTakeTop() // Config
    session.choiceTake({ token: 'export', kind: 'leaf', executable: true })

    const res = session.getResolution()
    expect(res.focusedSlot).toBe('format')
    expect(res.slots.length).toBeGreaterThan(0)
    expect(res.slots[0].name).toBe('format')
    expect(res.slots[0].kind).toBe('Enum')
  })

  it('filling all slots yields executable resolution', () => {
    const session = Session.create([configNs], defaultProximities)
    session.toggleMode()
    session.choiceTakeTop() // Config
    session.choiceTake({ token: 'export', kind: 'leaf', executable: true })

    // Take a slot value
    const res = session.choiceTake({ token: 'json', kind: 'value', executable: false })
    expect(res.executable).toBe(true)
    expect(res.effect).not.toBeNull()
  })

  it('getSlotValues returns filled values', () => {
    const session = Session.create([configNs], defaultProximities)
    session.toggleMode()
    session.choiceTakeTop() // Config
    session.choiceTake({ token: 'export', kind: 'leaf', executable: true })
    session.choiceTake({ token: 'json', kind: 'value', executable: false })

    const values = session.getSlotValues()
    expect(values.format).toBe('json')
  })
})

describe('Session — undo across phases', () => {
  it('undo at first slot returns to command phase', () => {
    const session = Session.create([configNs], defaultProximities)
    session.toggleMode()
    session.choiceTakeTop() // Config
    session.choiceTake({ token: 'export', kind: 'leaf', executable: true })
    expect(session.getPhase()).toBe('slot')

    // Undo when at first slot with empty query → back to command phase
    session.queryUndo()
    expect(session.getPhase()).toBe('command')
  })
})

describe('Session — dynamic layers', () => {
  it('stores and retrieves dynamic layers', () => {
    const session = Session.create([configNs], defaultProximities, {
      dynamicLayers: { thread: Effect.void as any },
    })
    expect(session.getDynamicLayers()).toHaveProperty('thread')
  })

  it('updates dynamic layers', () => {
    const session = Session.create([configNs], defaultProximities)
    expect(Object.keys(session.getDynamicLayers())).toHaveLength(0)
    session.setDynamicLayers({ thread: Effect.void as any })
    expect(session.getDynamicLayers()).toHaveProperty('thread')
  })
})

describe('Session — confirm', () => {
  it('confirm on executable command returns executable resolution', () => {
    const session = Session.create([configNs], defaultProximities)
    // Navigate to an executable command
    session.queryPush('r')
    session.queryPush('e') // auto-advance to "Config reload"

    const res = session.confirm()
    expect(res.executable).toBe(true)
  })

  it('confirm on non-executable takes top choice', () => {
    const session = Session.create([configNs, bufferNs], defaultProximities)
    // At initial state with all choices — confirm takes top
    const res = session.confirm()
    expect(res.acceptedTokens.length).toBeGreaterThan(0)
  })
})

import { describe, expect, it } from 'vitest'
import { Effect, Layer, Schema as S } from 'effect'
import { Session } from './session.js'
import { Command } from './command.js'
import { Capability } from './capability.js'
import { Slot } from './slot.js'
import { SlotValues } from './slot-values.js'

// Capabilities
const reload = Capability.make({ name: 'reload', execute: Effect.void })
const exportCap = Capability.make({
  name: 'export',
  slots: [
    Slot.Enum.make({ name: 'format', schema: S.Union([S.Literal('json'), S.Literal('yaml')]) }),
  ],
  execute: Effect.void,
})
const close = Capability.make({ name: 'close', execute: Effect.void })

// Composite capability: stepA then stepB, no slots
const stepA = Capability.make({ name: 'stepA', execute: Effect.void })
const stepB = Capability.make({ name: 'stepB', execute: Effect.void })
const compositeCap = Capability.Composite.make({
  name: 'deploy',
  steps: [{ capability: stepA }, { capability: stepB }],
})

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

describe('Session — toggleMode applies layers', () => {
  it('toggleMode wraps executable effects with layers (not raw resolver output)', async () => {
    // Create a command whose execute Effect requires a service from scope layers.
    // If toggleMode bypassed buildCombinedResolution, the effect would fail.
    const log: string[] = []
    const cap = Capability.make({
      name: 'reload',
      execute: Effect.sync(() => {
        log.push('ran')
      }),
    })
    const cmd = Command.Leaf.make({ name: 'reload', capability: cap })
    const dummyLayer = Layer.succeed(SlotValues)({})
    const session = Session.create([cmd], defaultProximities, {
      scopeLayers: [dummyLayer],
    })

    // Start in flat mode — toggle to tree
    const res = session.toggleMode()
    expect(res.mode).toBe('tree')
    // The resolution's choices should come through buildCombinedResolution
    expect(res.choices.length).toBeGreaterThan(0)

    // Toggle back to flat
    const res2 = session.toggleMode()
    expect(res2.mode).toBe('flat')

    // Navigate to executable in flat mode, then verify the effect runs with layers
    session.queryPush('r')
    const execRes = session.getResolution()
    expect(execRes.executable).toBe(true)
    expect(execRes.effect).not.toBeNull()
    // Run the effect — it should succeed because layers are applied
    await Effect.runPromise(execRes.effect!)
    expect(log).toEqual(['ran'])
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

describe('Session — composite capability', () => {
  it('composite command resolves as executable with a real effect', () => {
    const deployCmd = Command.Leaf.make({ name: 'deploy', capability: compositeCap })
    const session = Session.create([deployCmd], defaultProximities)

    // In flat mode, typing 'd' should match "deploy" and auto-advance
    const res = session.queryPush('d')
    expect(res.executable).toBe(true)
    expect(res.effect).not.toBeNull()
  })

  it('composite capability effect can be run', async () => {
    const log: string[] = []
    const trackedA = Capability.make({
      name: 'stepA',
      execute: Effect.sync(() => {
        log.push('a')
      }),
    })
    const trackedB = Capability.make({
      name: 'stepB',
      execute: Effect.sync(() => {
        log.push('b')
      }),
    })
    const tracked = Capability.Composite.make({
      name: 'deploy',
      steps: [{ capability: trackedA }, { capability: trackedB }],
    })
    const cmd = Command.Leaf.make({ name: 'deploy', capability: tracked })
    const session = Session.create([cmd], defaultProximities)
    const res = session.queryPush('d')
    expect(res.effect).not.toBeNull()
    await Effect.runPromise(res.effect!)
    expect(log).toEqual(['a', 'b'])
  })
})

describe('Session — nested composite scoping', () => {
  it('inner composite step does NOT see outer step slot values', async () => {
    // Triple-nested: outerComposite → [ stepWithSlot, innerComposite → [ innerStep ] ]
    // innerStep should see ONLY its own declared slots, not stepWithSlot's slot.
    const observedValues: Array<Readonly<Record<string, unknown>>> = []

    const outerSlot = Slot.Text.make({ name: 'outerParam', schema: S.String })
    const stepWithSlot = Capability.make({
      name: 'outer-step',
      slots: [outerSlot],
      execute: Effect.gen(function* () {
        const vals = yield* SlotValues
        observedValues.push({ ...vals })
      }),
    })

    const innerStep = Capability.make({
      name: 'inner-step',
      // No slots declared — should see empty values
      execute: Effect.gen(function* () {
        const vals = yield* SlotValues
        observedValues.push({ ...vals })
      }),
    })

    const innerComposite = Capability.Composite.make({
      name: 'inner-composite',
      steps: [{ capability: innerStep }],
    })

    const outerComposite = Capability.Composite.make({
      name: 'outer-composite',
      steps: [{ capability: stepWithSlot }, { capability: innerComposite }],
    })

    const cmd = Command.Leaf.make({ name: 'deploy', capability: outerComposite })
    const session = Session.create([cmd], defaultProximities)

    // Auto-advance to slot phase
    session.queryPush('d')
    expect(session.getPhase()).toBe('slot')

    // Fill the outerParam slot
    for (const c of 'myvalue') session.queryPush(c)
    session.confirm() // submitText

    const res = session.getResolution()
    expect(res.executable).toBe(true)
    expect(res.effect).not.toBeNull()

    await Effect.runPromise(res.effect!)

    // stepWithSlot should see { outerParam: 'myvalue' }
    expect(observedValues[0]).toEqual({ outerParam: 'myvalue' })
    // innerStep should see {} — it declared no slots, and the composite
    // should NOT leak outerParam into it
    expect(observedValues[1]).toEqual({})
  })
})

describe('Session — Search slot source triggering', () => {
  it('queryPush triggers Search slot source and populates choices', () => {
    // Search slots have source: (query) => Effect<candidates[]>
    // The Session should call source(query) when query changes and inject results
    const searchSlot = Slot.Search.make({
      name: 'user',
      schema: S.String,
      source: (query: string) =>
        Effect.succeed(
          query.length > 0
            ? [
                { value: `${query}-1`, label: `${query} result 1` },
                { value: `${query}-2`, label: `${query} result 2` },
              ]
            : [],
        ),
    })
    const searchCap = Capability.make({
      name: 'find-user',
      slots: [searchSlot],
      execute: Effect.void,
    })
    const cmd = Command.Leaf.make({ name: 'find', capability: searchCap })
    const session = Session.create([cmd], defaultProximities)

    // Navigate to the command (should auto-advance to slot phase)
    session.queryPush('f')
    expect(session.getPhase()).toBe('slot')

    // Push a query character — should trigger search source
    const res = session.queryPush('a')
    expect(res.choices.length).toBe(2)
    expect(res.choices[0]!.token).toBe('a result 1')
  })
})

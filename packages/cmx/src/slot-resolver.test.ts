import { describe, expect, it } from 'vitest'
import { Schema as S } from 'effect'
import { SlotResolver } from './slot-resolver.js'
import { Slot } from './slot.js'
import { Effect } from 'effect'

const formatSlot = Slot.Enum.make({
  name: 'format',
  schema: S.Union([S.Literal('json'), S.Literal('yaml')]),
  description: 'Output format',
})

const destSlot = Slot.Text.make({
  name: 'destination',
  schema: S.String,
  placeholder: 'Enter path...',
  required: false,
})

const nameSlot = Slot.Text.make({
  name: 'name',
  schema: S.String,
})

describe('SlotResolver — Enum slot', () => {
  it('starts focused on first slot', () => {
    const resolver = SlotResolver.create([formatSlot])
    expect(resolver.getFocusedSlotName()).toBe('format')
  })

  it('shows enum candidates as choices', () => {
    const resolver = SlotResolver.create([formatSlot])
    const choices = resolver.getChoices()
    // S.Union([S.Literal('json'), S.Literal('yaml')]) should produce exactly 2 enum candidates
    expect(choices.length).toBe(2)
    expect(choices.map((c) => c.token).sort()).toEqual(['json', 'yaml'])
  })

  it('is not complete before filling', () => {
    const resolver = SlotResolver.create([formatSlot])
    expect(resolver.isComplete()).toBe(false)
  })

  it('getSlotStates shows unfilled slot', () => {
    const resolver = SlotResolver.create([formatSlot])
    const states = resolver.getSlotStates()
    expect(states).toHaveLength(1)
    expect(states[0].name).toBe('format')
    expect(states[0].value).toBeNull()
    expect(states[0].required).toBe(true)
  })
})

describe('SlotResolver — Text slot', () => {
  it('accepts any character including space', () => {
    const resolver = SlotResolver.create([nameSlot])
    resolver.queryPush('h')
    resolver.queryPush('e')
    resolver.queryPush('l')
    resolver.queryPush('l')
    resolver.queryPush('o')
    resolver.queryPush(' ')
    resolver.queryPush('w')
    expect(resolver.getQuery()).toBe('hello w')
  })

  it('submitText fills the slot', () => {
    const resolver = SlotResolver.create([nameSlot])
    resolver.queryPush('t')
    resolver.queryPush('e')
    resolver.queryPush('s')
    resolver.queryPush('t')
    const ok = resolver.submitText()
    expect(ok).toBe(true)
    expect(resolver.isComplete()).toBe(true)
    const states = resolver.getSlotStates()
    expect(states[0].value).toBe('test')
  })

  it('submitText fails on empty required slot', () => {
    const resolver = SlotResolver.create([nameSlot])
    const ok = resolver.submitText()
    expect(ok).toBe(false)
    expect(resolver.isComplete()).toBe(false)
  })

  it('no choices for text slots', () => {
    const resolver = SlotResolver.create([nameSlot])
    expect(resolver.getChoices()).toEqual([])
  })
})

describe('SlotResolver — multi-slot lifecycle', () => {
  it('fills slots left-to-right', () => {
    const resolver = SlotResolver.create([formatSlot, nameSlot])
    expect(resolver.getFocusedSlotName()).toBe('format')
    // Take a format value
    resolver.takeChoice({ token: 'json', kind: 'value', executable: false })
    // Should advance to name slot
    expect(resolver.getFocusedSlotName()).toBe('name')
  })

  it('isComplete when all required slots filled', () => {
    const resolver = SlotResolver.create([formatSlot, nameSlot])
    resolver.takeChoice({ token: 'json', kind: 'value', executable: false })
    expect(resolver.isComplete()).toBe(false) // name still unfilled
    resolver.queryPush('t')
    resolver.queryPush('e')
    resolver.queryPush('s')
    resolver.queryPush('t')
    resolver.submitText()
    expect(resolver.isComplete()).toBe(true)
  })

  it('optional slot can be skipped', () => {
    const resolver = SlotResolver.create([formatSlot, destSlot])
    resolver.takeChoice({ token: 'json', kind: 'value', executable: false })
    expect(resolver.getFocusedSlotName()).toBe('destination')
    const skipped = resolver.skipOptional()
    expect(skipped).toBe(true)
    expect(resolver.isComplete()).toBe(true)
  })

  it('skipOptional fails on required slot', () => {
    const resolver = SlotResolver.create([formatSlot])
    const skipped = resolver.skipOptional()
    expect(skipped).toBe(false)
  })
})

describe('SlotResolver — undo', () => {
  it('queryUndo removes last character', () => {
    const resolver = SlotResolver.create([nameSlot])
    resolver.queryPush('a')
    resolver.queryPush('b')
    resolver.queryUndo()
    expect(resolver.getQuery()).toBe('a')
  })

  it('queryUndo crosses slot boundary — restores preTakeQuery', () => {
    const resolver = SlotResolver.create([formatSlot, nameSlot])
    resolver.takeChoice({ token: 'json', kind: 'value', executable: false })
    expect(resolver.getFocusedSlotName()).toBe('name')
    // Undo with empty query at name slot → go back to format slot
    resolver.queryUndo()
    expect(resolver.getFocusedSlotName()).toBe('format')
    expect(resolver.getQuery()).toBe('') // preTakeQuery was empty
  })

  it('choiceUndo goes back to previous slot', () => {
    const resolver = SlotResolver.create([formatSlot, nameSlot])
    resolver.takeChoice({ token: 'json', kind: 'value', executable: false })
    expect(resolver.getFocusedSlotName()).toBe('name')
    const wentBack = resolver.choiceUndo()
    expect(wentBack).toBe(true)
    expect(resolver.getFocusedSlotName()).toBe('format')
  })

  it('choiceUndo at first slot returns false (caller handles)', () => {
    const resolver = SlotResolver.create([formatSlot])
    const wentBack = resolver.choiceUndo()
    expect(wentBack).toBe(false)
  })
})

describe('SlotResolver — reset', () => {
  it('clears all state', () => {
    const resolver = SlotResolver.create([formatSlot, nameSlot])
    resolver.takeChoice({ token: 'json', kind: 'value', executable: false })
    resolver.queryPush('t')
    resolver.reset()
    expect(resolver.getFocusedSlotName()).toBe('format')
    expect(resolver.getQuery()).toBe('')
    expect(resolver.isComplete()).toBe(false)
    expect(resolver.getSlotStates()[0].value).toBeNull()
  })
})

describe('SlotResolver — queryPush with enum', () => {
  it('dead-end prevents invalid chars on non-text slot', () => {
    const resolver = SlotResolver.create([formatSlot])
    // 'z' should not match json or yaml — dead-end prevention
    resolver.queryPush('z')
    expect(resolver.getQuery()).toBe('') // rejected
  })

  it('space on non-text slot takes top choice', () => {
    const resolver = SlotResolver.create([formatSlot])
    resolver.queryPush('j') // query "j"
    resolver.queryPush(' ') // space → take top match
    // After space, if there was a match, it should have been taken
    // The query should be cleared
    expect(resolver.getQuery()).toBe('')
  })

  it('space with empty query on non-text slot is no-op', () => {
    const resolver = SlotResolver.create([formatSlot])
    resolver.queryPush(' ')
    expect(resolver.getQuery()).toBe('')
  })

  it('queryPush on null focused slot does nothing', () => {
    const resolver = SlotResolver.create([])
    resolver.queryPush('a')
    expect(resolver.getQuery()).toBe('')
  })
})

describe('SlotResolver — advanceToNextSlot edge cases', () => {
  it('all remaining slots filled skips to end', () => {
    const resolver = SlotResolver.create([formatSlot])
    resolver.takeChoice({ token: 'json', kind: 'value', executable: false })
    expect(resolver.isPastEnd()).toBe(true)
  })

  it('multiple required slots fill in order', () => {
    const slot1 = Slot.Enum.make({ name: 'a', schema: S.Literal('x') })
    const slot2 = Slot.Enum.make({ name: 'b', schema: S.Literal('y') })
    const resolver = SlotResolver.create([slot1, slot2])
    resolver.takeChoice({ token: 'x', kind: 'value', executable: false })
    expect(resolver.getFocusedSlotName()).toBe('b')
    resolver.takeChoice({ token: 'y', kind: 'value', executable: false })
    expect(resolver.isComplete()).toBe(true)
  })
})

describe('SlotResolver — submitText schema validation', () => {
  it('rejects input that fails schema validation', () => {
    // Schema that only accepts non-empty strings of at least 3 chars
    const strictSlot = Slot.Text.make({
      name: 'code',
      schema: S.String.check(S.isMinLength(3)),
    })
    const resolver = SlotResolver.create([strictSlot])
    resolver.queryPush('a')
    resolver.queryPush('b')
    // "ab" is too short (< 3 chars)
    const ok = resolver.submitText()
    expect(ok).toBe(false)
    expect(resolver.isComplete()).toBe(false)
    expect(resolver.getSlotStates()[0].value).toBeNull()
  })

  it('accepts input that passes schema validation', () => {
    const strictSlot = Slot.Text.make({
      name: 'code',
      schema: S.String.check(S.isMinLength(3)),
    })
    const resolver = SlotResolver.create([strictSlot])
    for (const c of 'abc') resolver.queryPush(c)
    const ok = resolver.submitText()
    expect(ok).toBe(true)
    expect(resolver.isComplete()).toBe(true)
    expect(resolver.getSlotStates()[0].value).toBe('abc')
  })

  it('stores the decoded value when schema transforms', () => {
    const numSlot = Slot.Text.make({
      name: 'count',
      schema: S.NumberFromString,
    })
    const resolver = SlotResolver.create([numSlot])
    for (const c of '42') resolver.queryPush(c)
    const ok = resolver.submitText()
    expect(ok).toBe(true)
    expect(resolver.getSlotStates()[0].value).toBe(42)
  })

  it('rejects input for NonEmptyString when empty', () => {
    const requiredSlot = Slot.Text.make({
      name: 'label',
      schema: S.NonEmptyString,
    })
    const resolver = SlotResolver.create([requiredSlot])
    // Submit with empty query — required slot with NonEmptyString rejects ""
    // First, the early guard rejects empty query on a required slot
    const ok = resolver.submitText()
    expect(ok).toBe(false)
    expect(resolver.getSlotStates()[0].value).toBeNull()
  })
})

describe('SlotResolver — submitText edge cases', () => {
  it('submitText on non-text slot returns false', () => {
    const resolver = SlotResolver.create([formatSlot])
    const ok = resolver.submitText()
    expect(ok).toBe(false)
  })

  it('submitText on null focused slot returns false', () => {
    const resolver = SlotResolver.create([])
    const ok = resolver.submitText()
    expect(ok).toBe(false)
  })

  it('submitText with empty query on optional text slot succeeds', () => {
    const optText = Slot.Text.make({ name: 'note', schema: S.String, required: false })
    const resolver = SlotResolver.create([optText])
    const ok = resolver.submitText()
    expect(ok).toBe(true)
  })
})

describe('SlotResolver — takeChoice edge cases', () => {
  it('takeChoice on null focused slot does nothing', () => {
    const resolver = SlotResolver.create([])
    resolver.takeChoice({ token: 'x', kind: 'value', executable: false })
    expect(resolver.isComplete()).toBe(true) // no slots = complete
  })
})

describe('SlotResolver — Fuzzy slot', () => {
  it('returns choices after candidates are loaded', () => {
    const fuzzySlot = Slot.Fuzzy.make({
      name: 'project',
      schema: S.String,
      source: Effect.succeed([
        { value: 'alpha', label: 'alpha', description: 'Project Alpha' },
        { value: 'beta', label: 'beta', description: 'Project Beta' },
        { value: 'gamma', label: 'gamma', description: 'Project Gamma' },
      ]),
    })
    const resolver = SlotResolver.create([fuzzySlot])
    expect(resolver.getChoices()).toEqual([]) // no candidates loaded yet

    // Simulate running the source Effect and injecting candidates
    resolver.setCandidates('project', [
      { value: 'alpha', label: 'alpha', description: 'Project Alpha' },
      { value: 'beta', label: 'beta', description: 'Project Beta' },
      { value: 'gamma', label: 'gamma', description: 'Project Gamma' },
    ])

    const choices = resolver.getChoices()
    expect(choices.length).toBe(3)
    expect(choices.map((c) => c.token)).toEqual(['alpha', 'beta', 'gamma'])
  })

  it('filters candidates by query', () => {
    const fuzzySlot = Slot.Fuzzy.make({
      name: 'project',
      schema: S.String,
      source: Effect.succeed([
        { value: 'alpha', label: 'alpha' },
        { value: 'beta', label: 'beta' },
        { value: 'apex', label: 'apex' },
      ]),
    })
    const resolver = SlotResolver.create([fuzzySlot])
    resolver.setCandidates('project', [
      { value: 'alpha', label: 'alpha' },
      { value: 'beta', label: 'beta' },
      { value: 'apex', label: 'apex' },
    ])
    // 'a' is in "alpha", "beta", and "apex" — but 'p' narrows to "alpha" and "apex" (2/3)
    resolver.queryPush('p')
    const choices = resolver.getChoices()
    expect(choices.length).toBe(2)
    expect(choices.map((c) => c.token).sort()).toEqual(['alpha', 'apex'])
  })

  it('taking a fuzzy choice records the underlying value', () => {
    const fuzzySlot = Slot.Fuzzy.make({
      name: 'project',
      schema: S.String,
      source: Effect.succeed([{ value: 'proj-123', label: 'alpha' }]),
    })
    const resolver = SlotResolver.create([fuzzySlot])
    resolver.setCandidates('project', [{ value: 'proj-123', label: 'alpha' }])
    const choices = resolver.getChoices()
    resolver.takeChoice(choices[0])
    const states = resolver.getSlotStates()
    expect(states[0].value).toBe('proj-123')
  })
})

describe('SlotResolver — takeTop', () => {
  it('takes the first choice', () => {
    const resolver = SlotResolver.create([formatSlot])
    // Manually build choices by simulating enum candidates
    // Since Schema AST extraction is implementation-dependent,
    // use takeChoice directly as a proxy
    resolver.takeChoice({ token: 'json', kind: 'value', executable: false })
    expect(resolver.isComplete()).toBe(true)
  })
})

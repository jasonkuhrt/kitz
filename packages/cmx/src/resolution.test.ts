import { describe, expect, it } from 'vitest'
import type { Choice, AcceptedToken } from './choice.js'
import { emptyResolution } from './resolution.js'
import { HandleKeyResult } from './handle-key-result.js'

describe('Choice', () => {
  it('carries command metadata', () => {
    const choice: Choice = {
      token: 'reload',
      kind: 'leaf',
      executable: true,
      description: 'Reload config',
    }
    expect(choice.token).toBe('reload')
    expect(choice.kind).toBe('leaf')
    expect(choice.executable).toBe(true)
  })

  it('carries slot value metadata', () => {
    const choice: Choice = {
      token: 'json',
      kind: 'value',
      executable: false,
    }
    expect(choice.kind).toBe('value')
  })

  it('carries optional documentation', () => {
    const choice: Choice = {
      token: 'reload',
      kind: 'leaf',
      executable: true,
      keybinding: 'r',
      warning: 'Unsaved changes lost',
      deprecated: { replacement: 'Config refresh' },
      group: 'admin',
    }
    expect(choice.keybinding).toBe('r')
    expect(choice.warning).toBe('Unsaved changes lost')
    expect(choice.deprecated?.replacement).toBe('Config refresh')
    expect(choice.group).toBe('admin')
  })
})

describe('AcceptedToken', () => {
  it('carries token and preTakeQuery', () => {
    const token: AcceptedToken = {
      token: 'Config',
      preTakeQuery: 'C',
    }
    expect(token.token).toBe('Config')
    expect(token.preTakeQuery).toBe('C')
  })
})

describe('emptyResolution', () => {
  it('creates flat mode with no accepted tokens', () => {
    const choices: Choice[] = [
      { token: 'Config reload', kind: 'leaf', executable: true },
      { token: 'Buffer close', kind: 'leaf', executable: true },
    ]
    const res = emptyResolution(choices)
    expect(res.mode).toBe('flat')
    expect(res.acceptedTokens).toEqual([])
    expect(res.query).toBe('')
    expect(res._tag).toBe('None')
    expect(res.executable).toBe(false)
    expect(res.effect).toBeNull()
    expect(res.complete).toBe(false)
    expect(res.topChoice).toEqual(choices[0])
    expect(res.choices).toBe(choices)
    expect(res.choicesLoading).toBe(false)
    expect(res.slots).toEqual([])
    expect(res.focusedSlot).toBeNull()
  })

  it('topChoice is null when choices are empty', () => {
    const res = emptyResolution([])
    expect(res.topChoice).toBeNull()
    expect(res.choices).toEqual([])
  })
})

describe('HandleKeyResult', () => {
  it('creates Nil', () => {
    const result = HandleKeyResult.Nil()
    expect(result._tag).toBe('Nil')
  })

  it('creates Close', () => {
    const result = HandleKeyResult.Close()
    expect(result._tag).toBe('Close')
  })

  it('creates BeginPalette with resolution', () => {
    const res = emptyResolution([])
    const result = HandleKeyResult.BeginPalette(res)
    expect(result._tag).toBe('BeginPalette')
    expect(result.resolution).toBe(res)
  })

  it('creates BeginShortcut with executable flag', () => {
    const res = emptyResolution([])
    const result = HandleKeyResult.BeginShortcut(res, true)
    expect(result._tag).toBe('BeginShortcut')
    expect(result.executable).toBe(true)
  })

  it('creates Resolution', () => {
    const res = emptyResolution([])
    const result = HandleKeyResult.Resolution(res)
    expect(result._tag).toBe('Resolution')
  })

  it('creates Execute', () => {
    const res = emptyResolution([])
    const result = HandleKeyResult.Execute(res)
    expect(result._tag).toBe('Execute')
  })
})

import { describe, expect, it } from 'vitest'
import { Effect, Schema as S } from 'effect'
import { Slot } from './slot.js'

describe('Slot.Enum', () => {
  it('creates with schema', () => {
    const slot = Slot.Enum.make({
      name: 'format',
      schema: S.Literal('json', 'yaml'),
    })
    expect(slot._tag).toBe('Enum')
    expect(slot.name).toBe('format')
  })

  it('defaults required to undefined (true by convention)', () => {
    const slot = Slot.Enum.make({ name: 'format', schema: S.Literal('json') })
    expect(slot.required).toBeUndefined()
  })

  it('accepts documentation fields', () => {
    const slot = Slot.Enum.make({
      name: 'format',
      schema: S.Literal('json', 'yaml'),
      description: 'Output format',
      detail: 'The serialization format',
      placeholder: 'Choose format',
      required: false,
    })
    expect(slot.description).toBe('Output format')
    expect(slot.detail).toBe('The serialization format')
    expect(slot.placeholder).toBe('Choose format')
    expect(slot.required).toBe(false)
  })
})

describe('Slot.Fuzzy', () => {
  it('creates with source', () => {
    const slot = Slot.Fuzzy.make({
      name: 'email',
      schema: S.String,
      source: Effect.succeed([{ value: 'test@example.com', label: 'Test' }]),
    })
    expect(slot._tag).toBe('Fuzzy')
    expect(slot.name).toBe('email')
  })
})

describe('Slot.Search', () => {
  it('creates with query-based source', () => {
    const slot = Slot.Search.make({
      name: 'file',
      schema: S.String,
      source: (_query: string) => Effect.succeed([{ value: '/tmp', label: '/tmp' }]),
    })
    expect(slot._tag).toBe('Search')
    expect(slot.name).toBe('file')
  })
})

describe('Slot.Text', () => {
  it('creates with schema for validation', () => {
    const slot = Slot.Text.make({
      name: 'name',
      schema: S.String.check(S.isMinLength(1)),
    })
    expect(slot._tag).toBe('Text')
    expect(slot.name).toBe('name')
  })

  it('accepts placeholder', () => {
    const slot = Slot.Text.make({
      name: 'name',
      schema: S.String,
      placeholder: 'Enter a name...',
    })
    expect(slot.placeholder).toBe('Enter a name...')
  })
})

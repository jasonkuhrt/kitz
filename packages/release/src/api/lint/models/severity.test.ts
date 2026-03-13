import { Schema } from 'effect'
import { describe, expect, test } from 'vitest'
import * as Severity from './severity.js'

describe('Severity', () => {
  test('Error instantiation', () => {
    const e = Severity.Error.make({})
    expect(e._tag).toBe('SeverityError')
    expect(Severity.Error.is(e)).toBe(true)
    expect(Severity.Warn.is(e)).toBe(false)
  })

  test('Warn instantiation', () => {
    const w = Severity.Warn.make({})
    expect(w._tag).toBe('SeverityWarn')
    expect(Severity.Warn.is(w)).toBe(true)
    expect(Severity.Error.is(w)).toBe(false)
  })

  test('Severity union is()', () => {
    const e = Severity.Error.make({})
    const w = Severity.Warn.make({})
    expect(Severity.is(e)).toBe(true)
    expect(Severity.is(w)).toBe(true)
    expect(Severity.is({})).toBe(false)
  })

  test('schema roundtrip for Error', () => {
    const e = Severity.Error.make({})
    const encoded = Schema.encodeSync(Severity.Severity)(e)
    const decoded = Schema.decodeSync(Severity.Severity)(encoded)
    expect(decoded._tag).toBe('SeverityError')
  })

  test('schema roundtrip for Warn', () => {
    const w = Severity.Warn.make({})
    const encoded = Schema.encodeSync(Severity.Severity)(w)
    const decoded = Schema.decodeSync(Severity.Severity)(encoded)
    expect(decoded._tag).toBe('SeverityWarn')
  })
})

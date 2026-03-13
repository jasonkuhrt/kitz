import { Schema } from 'effect'
import { describe, expect, test } from 'vitest'
import * as Severity from './severity.js'

describe('Severity', () => {
  test('Error instantiation', () => {
    const e = new Severity.Error({})
    expect(e._tag).toBe('SeverityError')
    expect(Severity.Error.is(e)).toBe(true)
    expect(Severity.Warn.is(e)).toBe(false)
  })

  test('Warn instantiation', () => {
    const w = new Severity.Warn({})
    expect(w._tag).toBe('SeverityWarn')
    expect(Severity.Warn.is(w)).toBe(true)
    expect(Severity.Error.is(w)).toBe(false)
  })

  test('Severity union is()', () => {
    const e = new Severity.Error({})
    const w = new Severity.Warn({})
    expect(Severity.is(e)).toBe(true)
    expect(Severity.is(w)).toBe(true)
    expect(Severity.is({})).toBe(false)
  })

  test('schema roundtrip for Error', () => {
    const e = new Severity.Error({})
    const encoded = Schema.encodeSync(Severity.Severity)(e)
    const decoded = Schema.decodeSync(Severity.Severity)(encoded)
    expect(decoded._tag).toBe('SeverityError')
  })

  test('schema roundtrip for Warn', () => {
    const w = new Severity.Warn({})
    const encoded = Schema.encodeSync(Severity.Severity)(w)
    const decoded = Schema.decodeSync(Severity.Severity)(encoded)
    expect(decoded._tag).toBe('SeverityWarn')
  })
})

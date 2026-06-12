import { Exit, Schema } from 'effect'
import { describe, expect, test } from 'bun:test'
import * as Severity from './severity.js'

describe('Severity', () => {
  test('accepts both severity literals', () => {
    expect(Severity.is('error')).toBe(true)
    expect(Severity.is('warn')).toBe(true)
  })

  test('rejects non-severity values', () => {
    expect(Severity.is('fatal')).toBe(false)
    expect(Severity.is({})).toBe(false)
    expect(Severity.is(42)).toBe(false)
  })

  test('schema roundtrip', () => {
    for (const severity of ['error', 'warn'] as const) {
      const encoded = Schema.encodeSync(Severity.Severity)(severity)
      expect(Schema.decodeSync(Severity.Severity)(encoded)).toBe(severity)
    }
  })

  test('decoding an invalid value fails with a schema error', () => {
    expect(Exit.isFailure(Schema.decodeUnknownExit(Severity.Severity)('loud'))).toBe(true)
  })
})

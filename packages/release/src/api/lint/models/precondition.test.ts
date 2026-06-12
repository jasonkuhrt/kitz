import { Exit, Schema } from 'effect'
import { describe, expect, test } from 'bun:test'
import { Precondition } from './precondition.js'

const allPreconditions = [
  'hasOpenPR',
  'hasDiff',
  'isMonorepo',
  'hasGitHubAccess',
  'hasReleasePlan',
] as const

describe('Precondition', () => {
  test('accepts every precondition literal', () => {
    const is = Schema.is(Precondition)
    for (const precondition of allPreconditions) {
      expect(is(precondition)).toBe(true)
    }
  })

  test('rejects unknown values', () => {
    const is = Schema.is(Precondition)
    expect(is('hasUnicorn')).toBe(false)
    expect(is({})).toBe(false)
  })

  test('schema roundtrip for each literal', () => {
    for (const precondition of allPreconditions) {
      const encoded = Schema.encodeSync(Precondition)(precondition)
      expect(Schema.decodeSync(Precondition)(encoded)).toBe(precondition)
    }
  })

  test('decoding an invalid value fails with a schema error', () => {
    expect(Exit.isFailure(Schema.decodeUnknownExit(Precondition)('hasUnicorn'))).toBe(true)
  })
})

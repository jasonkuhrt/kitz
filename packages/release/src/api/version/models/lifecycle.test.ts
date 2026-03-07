import { Schema } from 'effect'
import { describe, expect, test } from 'vitest'

// Read the lifecycle module to test it
import { type Lifecycle, LifecycleSchema } from './lifecycle.js'

describe('Lifecycle', () => {
  test('official is valid', () => {
    const result = Schema.decodeSync(LifecycleSchema)('official')
    expect(result).toBe('official')
  })

  test('candidate is valid', () => {
    const result = Schema.decodeSync(LifecycleSchema)('candidate')
    expect(result).toBe('candidate')
  })

  test('ephemeral is valid', () => {
    const result = Schema.decodeSync(LifecycleSchema)('ephemeral')
    expect(result).toBe('ephemeral')
  })

  test('invalid value fails', () => {
    expect(() => Schema.decodeUnknownSync(LifecycleSchema)('invalid')).toThrow(/./)
  })

  test('roundtrip encode/decode', () => {
    const lifecycles: Lifecycle[] = ['official', 'candidate', 'ephemeral']
    for (const l of lifecycles) {
      const encoded = Schema.encodeSync(LifecycleSchema)(l)
      const decoded = Schema.decodeSync(LifecycleSchema)(encoded)
      expect(decoded).toBe(l)
    }
  })
})

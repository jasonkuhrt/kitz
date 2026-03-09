import { describe, expect, test } from 'vitest'
import { ReleaseError } from './errors.js'

describe('ReleaseError', () => {
  test('constructs with operation and detail', () => {
    const err = new ReleaseError({
      context: {
        operation: 'plan',
        detail: 'No packages found',
      },
    })
    expect(err._tag).toBe('ReleaseError')
    expect(err.message).toContain('plan')
    expect(err.message).toContain('No packages found')
  })

  test('constructs with operation only', () => {
    const err = new ReleaseError({
      context: {
        operation: 'apply',
      },
    })
    expect(err.message).toContain('apply')
  })

  test('supports all operation literals', () => {
    for (const operation of ['plan', 'apply', 'tag'] as const) {
      const err = new ReleaseError({
        context: { operation, detail: 'test' },
      })
      expect(err.context.operation).toBe(operation)
    }
  })

  test('is an Error instance', () => {
    const err = new ReleaseError({
      context: { operation: 'plan', detail: 'test' },
    })
    expect(err).toBeInstanceOf(Error)
  })
})

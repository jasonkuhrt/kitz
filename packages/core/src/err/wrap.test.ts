import { describe, expect, test } from 'bun:test'
import { wrap, wrapOn, wrapWith } from './wrap.js'

describe('wrap', () => {
  test('wraps error with message', () => {
    const cause = new Error('Original error')
    const wrapped = wrap(cause, 'High level error')

    expect(wrapped.message).toBe('High level error')
    expect(wrapped.cause).toBe(cause)
  })

  test('wraps non-error values', () => {
    const wrapped = wrap('string error', 'Wrapped message')

    expect(wrapped.message).toBe('Wrapped message')
    expect(wrapped.cause).toBeInstanceOf(Error)
    expect((wrapped.cause as Error).message).toBe('string error')
  })

  test('wraps with context', () => {
    const cause = new Error('Original')
    const wrapped = wrap(cause, {
      message: 'Failed operation',
      context: { userId: 123, operation: 'update' },
    })

    expect(wrapped.message).toBe('Failed operation')
    expect(wrapped.cause).toBe(cause)
    expect((wrapped as any).context).toEqual({ userId: 123, operation: 'update' })
  })
})

describe('wrapOn', () => {
  test('curries with error first', () => {
    const cause = new Error('Original')
    const wrapError = wrapOn(cause)

    const wrapped1 = wrapError('First wrapper')
    const wrapped2 = wrapError('Second wrapper')

    expect(wrapped1.message).toBe('First wrapper')
    expect(wrapped1.cause).toBe(cause)
    expect(wrapped2.message).toBe('Second wrapper')
    expect(wrapped2.cause).toBe(cause)
  })
})

describe('wrapWith', () => {
  test('curries with message first', () => {
    const wrapAsNetworkError = wrapWith('Network request failed')

    const error1 = new Error('Timeout')
    const error2 = new Error('Connection refused')

    const wrapped1 = wrapAsNetworkError(error1)
    const wrapped2 = wrapAsNetworkError(error2)

    expect(wrapped1.message).toBe('Network request failed')
    expect(wrapped1.cause).toBe(error1)
    expect(wrapped2.message).toBe('Network request failed')
    expect(wrapped2.cause).toBe(error2)
  })

  test('curries with options', () => {
    const wrapAsUserError = wrapWith({
      message: 'User operation failed',
      context: { service: 'auth' },
    })

    const cause = new Error('Invalid token')
    const wrapped = wrapAsUserError(cause)

    expect(wrapped.message).toBe('User operation failed')
    expect((wrapped as any).context).toEqual({ service: 'auth' })
  })
})

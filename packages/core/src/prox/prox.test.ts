import { describe, expect, test } from 'vitest'
import { createCachedGetProxy } from './prox.js'

describe('createCachedGetProxy', () => {
  test('creates a proxy that caches function results', () => {
    let callCount = 0
    const proxy = createCachedGetProxy<{ foo: () => string }, {}>((propertyName: string) => {
      callCount++
      return () => `${propertyName}-result`
    })

    // First access
    const foo1 = proxy.foo
    expect(typeof foo1).toBe('function')
    expect(foo1()).toBe('foo-result')
    expect(callCount).toBe(1)

    // Second access - should use cache
    const foo2 = proxy.foo
    expect(foo1).toBe(foo2) // Same reference
    expect(callCount).toBe(1) // Not called again
  })

  test('handles symbols when symbols option is false', () => {
    const proxy = createCachedGetProxy<any, { symbols: false }>(
      (propertyName: string) => () => propertyName,
      { symbols: false },
    )

    expect(proxy[Symbol.toStringTag]).toBeUndefined()
    expect(proxy[Symbol.iterator]).toBeUndefined()
  })

  test('handles symbols when symbols option is true', () => {
    const proxy = createCachedGetProxy<any, { symbols: true }>(
      (propertyName: string | symbol) => () => String(propertyName),
      { symbols: true },
    )

    const symResult = proxy[Symbol.toStringTag]
    expect(typeof symResult).toBe('function')
    expect(symResult()).toBe('Symbol(Symbol.toStringTag)')
  })

  test('preserves existing properties on target', () => {
    const proxy = createCachedGetProxy<{ foo: () => string; $: { bar: string } }, {}>(
      (propertyName: string) => () => propertyName,
    ) // Add a property to the proxy target
    ;(proxy as any).$ = { bar: 'baz' }

    // Should return the actual property, not a generated function
    expect(proxy.$).toEqual({ bar: 'baz' })
  })
})

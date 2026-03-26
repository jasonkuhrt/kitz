import type { Fn } from '@kitz/core'
import { describe, expect, test } from 'vitest'
import * as AssertNamespace from './_.js'
import * as Assert from './__.js'
import { builder } from './builder-singleton.js'

const call = (fn: unknown, ...args: unknown[]) => {
  return (fn as (...args: unknown[]) => unknown)(...args)
}

const extractValue: Fn.Extractor<{ value: string }, string> = Object.assign(
  (input: { value: string }) => input.value,
  { kind: {} as never },
)

describe('assert', () => {
  test('exports the recursive assertion builder namespace', () => {
    expect(AssertNamespace.Assert.any).toBe(Assert.any)
    expect(Assert.any).toBe(builder.any)
    expect(Assert.unknown).toBe(builder.unknown)
    expect(Assert.never).toBe(builder.never)
    expect(Assert.empty).toBe(builder.empty)
    expect(Assert.on).toBe(builder.on)
    expect(Assert.onAs).toBe(builder.onAs)
    expect(Assert.inferNarrow).toBe(builder.inferNarrow)
    expect(Assert.inferWide).toBe(builder.inferWide)
    expect(Assert.inferAuto).toBe(builder.inferAuto)
  })

  test('allows calling top-level builder entrypoints at runtime', () => {
    expect(call(Assert.any, 'value')).toBe(builder)
    expect(call(Assert.unknown, { value: true })).toBe(builder)
    expect(call(Assert.never, undefined)).toBe(builder)
    expect(call(Assert.empty, [])).toBe(builder)
    expect(call(Assert.on, 'text')).toBe(builder)
    expect(call(Assert.onAs)).toBe(builder)
    expect(call(Assert.extract, extractValue)).toBe(builder)
    expect(call(Assert.setInfer, 'auto')).toBe(builder)
  })

  test('supports builder settings helpers and nested namespaces', () => {
    expect(typeof Assert.extract).toBe('function')
    expect(typeof Assert.exact.of).toBe('function')
    expect(typeof Assert.sub.of).toBe('function')
    expect(typeof Assert.equiv.of).toBe('function')
    expect(typeof Assert.not.exact.number).toBe('function')
    expect(typeof Assert.array.exact.of).toBe('function')
    expect(typeof Assert.awaited.sub.of).toBe('function')
    expect(typeof Assert.returned.equiv.of).toBe('function')
    expect(typeof Assert.parameter2.not.exact.of).toBe('function')
    expect(typeof Assert.parameter3.sub.of).toBe('function')
    expect(typeof Assert.parameter4.equiv.of).toBe('function')
    expect(typeof Assert.parameter5.not.sub.of).toBe('function')
    expect(typeof Assert.array.not.equiv.of).toBe('function')
    expect(typeof Assert.awaited.not.exact.of).toBe('function')
    expect(typeof Assert.returned.not.sub.of).toBe('function')
  })
})

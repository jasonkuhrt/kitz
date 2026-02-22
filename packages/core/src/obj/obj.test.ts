import { Assert } from '#kitz/assert'
import { Test } from '#kitz/test'
import { describe, expect, test } from 'vitest'
import { type FromEntries, fromEntries, hasSymbolLike, hasSymbolLikeWith } from './obj.js'

const sym = (name: string, val: unknown) => {
  const s = Symbol(name)
  return { value: { [s]: val }, symbol: s, expectedValue: val }
}

const symMismatch = (name: string, val: unknown, expected: unknown) => {
  const s1 = Symbol(name)
  const s2 = Symbol(name)
  return { value: { [s1]: val }, symbol: s2, expectedValue: expected }
}

Test.describe('hasSymbolLike')
  .inputType<{ value: unknown; symbol: symbol; expectedValue: unknown }>()
  .outputType<boolean>()
  .cases(
    // Direct matches
    [sym('Transport', 'http'), true],
    [sym('id', 123), true],
    // Mismatches
    [{ ...sym('Transport', 'http'), expectedValue: 'https' }, false],
    [{ value: {}, symbol: Symbol('x'), expectedValue: 'any' }, false],
    // Symbol instance mismatch (fallback)
    [symMismatch('id', 'value', 'value'), true],
    [symMismatch('id', 'value', 'wrong'), false],
    [{ value: { [Symbol('id')]: 'v' }, symbol: Symbol('name'), expectedValue: 'v' }, false],
    // Non-objects
    [{ value: null, symbol: Symbol('x'), expectedValue: 'any' }, false],
    [{ value: undefined, symbol: Symbol('x'), expectedValue: 'any' }, false],
    [{ value: 'string', symbol: Symbol('x'), expectedValue: 'any' }, false],
    [{ value: 42, symbol: Symbol('x'), expectedValue: 'any' }, false],
    // Edge cases
    [sym('test', undefined), true],
    [sym('test', null), true],
    [
      (() => {
        const s = Symbol()
        return { value: { [s]: 'v' }, symbol: s, expectedValue: 'v' }
      })(),
      true,
    ],
  )
  .test(({ input, output }) => {
    expect(hasSymbolLike(input.value, input.symbol, input.expectedValue)).toBe(output)
  })

Test.describe('hasSymbolLikeWith')
  .inputType<{ symbol: symbol; expectedValue: unknown; value: unknown }>()
  .outputType<boolean>()
  .cases(
    [
      (() => {
        const s = Symbol('Kind')
        return { symbol: s, expectedValue: 'user', value: { [s]: 'user' } }
      })(),
      true,
    ],
    [
      (() => {
        const s = Symbol('Kind')
        return { symbol: s, expectedValue: 'user', value: { [s]: 'post' } }
      })(),
      false,
    ],
  )
  .test(({ input, output }) => {
    expect(hasSymbolLikeWith(input.symbol, input.expectedValue)(input.value)).toBe(output)
  })

Test.describe('fromEntries')
  .inputType<readonly (readonly [PropertyKey, unknown])[]>()
  .outputType<object>()
  .cases(
    // Basic string keys
    [[['a', 1], ['b', 2]] as const, { a: 1, b: 2 }],
    // Mixed value types
    [[['x', 'hello'], ['y', 42]] as const, { x: 'hello', y: 42 }],
    // Empty entries
    [[] as const, {}],
    // Number keys (converted to string at runtime)
    [[[1, 'one'], [2, 'two']] as const, { 1: 'one', 2: 'two' }],
  )
  .test(({ input, output }) => {
    expect(fromEntries(input)).toEqual(output)
  })

describe('FromEntries type-level', () => {
  test('preserves keys and values', () => {
    // Basic key preservation
    Assert.Type.exact.ofAs<{ a: 1; b: 2 }>().onAs<FromEntries<readonly [readonly ['a', 1], readonly ['b', 2]]>>()

    // Mixed value types preserved
    Assert.Type.exact.ofAs<{ x: 'hello'; y: 42 }>().onAs<
      FromEntries<readonly [readonly ['x', 'hello'], readonly ['y', 42]]>
    >()

    // Empty entries produces empty object
    Assert.Type.exact.ofAs<{}>().onAs<FromEntries<readonly []>>()

    // Number keys work
    Assert.Type.exact.ofAs<{ 1: 'one'; 2: 'two' }>().onAs<
      FromEntries<readonly [readonly [1, 'one'], readonly [2, 'two']]>
    >()

    // Runtime value type inference
    const entries = [['a', 1], ['b', 'hello']] as const
    const result = fromEntries(entries)
    Assert.Type.exact.ofAs<{ a: 1; b: 'hello' }>().on(result)
  })
})

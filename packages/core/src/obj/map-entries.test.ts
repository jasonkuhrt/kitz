import { Obj } from '#obj'
import { describe, expect, test } from 'bun:test'

describe('mapEntries', () => {
  test('transforms both keys and values', () => {
    const obj = { a: 1, b: 2 }
    const result = Obj.mapEntries(obj, (k, v) => [k.toUpperCase(), v * 2])
    expect(result).toEqual({ A: 2, B: 4 })
  })

  test('empty object returns empty object', () => {
    const result = Obj.mapEntries({}, (k, v) => [k, v])
    expect(result).toEqual({})
  })

  test('can change key type', () => {
    const obj = { a: 1, b: 2 }
    const result = Obj.mapEntries(obj, (k, v) => [v, k])
    expect(result).toEqual({ 1: 'a', 2: 'b' })
  })
})

describe('mapKeys', () => {
  test('transforms keys only', () => {
    const obj = { firstName: 'Alice', lastName: 'Smith' }
    const result = Obj.mapKeys(obj, (k) => k.toUpperCase())
    expect(result).toEqual({ FIRSTNAME: 'Alice', LASTNAME: 'Smith' })
  })

  test('can access value in mapper', () => {
    const obj = { a: 1, b: 2 }
    const result = Obj.mapKeys(obj, (k, v) => `${k}_${v}`)
    expect(result).toEqual({ a_1: 1, b_2: 2 })
  })

  test('empty object returns empty object', () => {
    const result = Obj.mapKeys({}, (k) => k)
    expect(result).toEqual({})
  })

  test('lowercase keys', () => {
    const obj = { FOO: 1, BAR: 2 }
    const result = Obj.mapKeys(obj, (k) => k.toLowerCase())
    expect(result).toEqual({ foo: 1, bar: 2 })
  })
})

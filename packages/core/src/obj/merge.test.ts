import { Type as A } from '#kitz/assert/assert'
import { Obj } from '#obj'
import { Ts } from '#ts'
import fc from 'fast-check'
import { describe, expect, test } from 'vitest'

// ---- Fixtures ----
// NOTE: Merge functions mutate first argument, so fixtures return fresh copies

const fixtures = {
  simple: () => ({
    obj1: { a: 1, b: 2 },
    obj2: { b: 3, c: 4 },
  }),
  nested: () => ({
    obj1: { user: { name: 'Alice', age: 30 }, tags: ['a', 'b'] },
    obj2: { user: { age: 31, city: 'NYC' }, tags: ['c', 'd'] },
  }),
  withUndefined: () => ({
    obj1: { a: 1, b: 2, c: 3 },
    obj2: { a: 1, b: undefined, c: 4, d: 5 },
  }),
  withNull: () => ({
    obj1: { a: 1, b: null },
    obj2: { a: 1, b: 2, c: null },
  }),
  withArrays: () => ({
    obj1: { tags: ['react', 'typescript'] },
    obj2: { tags: ['nodejs', 'express'] },
  }),
  withDefaults: () => ({
    config: { port: 3000 },
    defaults: { port: 8080, host: 'localhost', debug: false },
  }),
  empty: () => ({ a: {}, b: {} }),
}

// ---- merge ----

describe('merge', () => {
  test('deep merges simple objects', () => {
    const { obj1, obj2 } = fixtures.simple()
    const result = Obj.merge(obj1, obj2)
    expect(result).toEqual({ a: 1, b: 3, c: 4 })
    A.sub.ofAs<{ a: number; b: number; c: number }>().on(result)
  })

  test('deep merges nested objects', () => {
    const { obj1, obj2 } = fixtures.nested()
    const result = Obj.merge(obj1, obj2)
    expect(result).toEqual({
      user: { name: 'Alice', age: 31, city: 'NYC' },
      tags: ['c', 'd'], // Arrays replaced, not merged
    })
    A.sub.ofAs<{
      user: { name: string; age: number; city: string }
      tags: string[]
    }>().on(result)
  })

  test('replaces arrays rather than merging', () => {
    const { obj1, obj2 } = fixtures.withArrays()
    const result = Obj.merge(obj1, obj2)
    expect(result).toEqual({ tags: ['nodejs', 'express'] })
  })

  test('handles empty objects', () => {
    const { a, b } = fixtures.empty()
    const result = Obj.merge(a, b)
    expect(result).toEqual({})
  })
})

// ---- mergeWith ----

describe('mergeWith', () => {
  test('allows undefined override when configured', () => {
    const { obj1, obj2 } = fixtures.withUndefined()
    const customMerge = Obj.mergeWith({ undefined: true })
    const result = customMerge(obj1, obj2)
    expect(result).toEqual({ a: 1, b: undefined, c: 4, d: 5 })
  })

  test('ignores undefined values by default', () => {
    const { obj1, obj2 } = fixtures.withUndefined()
    const customMerge = Obj.mergeWith()
    const result = customMerge(obj1, obj2)
    expect(result).toEqual({ a: 1, b: 2, c: 4, d: 5 })
  })

  test('accepts custom array merger', () => {
    const { obj1, obj2 } = fixtures.withArrays()
    const customMerge = Obj.mergeWith({
      array: (a, b) => {
        a.push(...b)
      },
    })
    const result = customMerge(obj1, obj2)
    expect(result).toEqual({ tags: ['react', 'typescript', 'nodejs', 'express'] })
  })
})

// ---- mergeWithArrayPush ----

describe('mergeWithArrayPush', () => {
  test('concatenates arrays when merging', () => {
    const { obj1, obj2 } = fixtures.withArrays()
    const result = Obj.mergeWithArrayPush(obj1, obj2)
    expect(result).toEqual({ tags: ['react', 'typescript', 'nodejs', 'express'] })
    A.sub.ofAs<{ tags: string[] }>().on(result)
  })

  test('works with nested arrays', () => {
    const obj1 = { user: { skills: ['js'] } }
    const obj2 = { user: { skills: ['ts'] } }
    const result = Obj.mergeWithArrayPush(obj1, obj2)
    expect(result).toEqual({ user: { skills: ['js', 'ts'] } })
  })

  test('handles non-array properties normally', () => {
    const { obj1, obj2 } = fixtures.simple()
    const result = Obj.mergeWithArrayPush(obj1, obj2)
    expect(result).toEqual({ a: 1, b: 3, c: 4 })
  })
})

// ---- mergeWithArrayPushDedupe ----

describe('mergeWithArrayPushDedupe', () => {
  test('concatenates and deduplicates arrays', () => {
    const obj1 = { tags: ['react', 'vue', 'react'] }
    const obj2 = { tags: ['react', 'angular'] }
    const result = Obj.mergeWithArrayPushDedupe(obj1, obj2)
    expect(result).toEqual({ tags: ['react', 'vue', 'angular'] })
  })

  test('preserves order with first occurrence kept', () => {
    const obj1 = { ids: [1, 2, 3] }
    const obj2 = { ids: [3, 4, 2, 5] }
    const result = Obj.mergeWithArrayPushDedupe(obj1, obj2)
    expect(result).toEqual({ ids: [1, 2, 3, 4, 5] })
  })
})

// ---- mergeDefaults ----

describe('mergeDefaults', () => {
  test('fills in missing properties', () => {
    const config = { port: 3000 }
    const defaults = { port: 8080, host: 'localhost', debug: false }
    const result = Obj.mergeDefaults(config, defaults)
    expect(result).toEqual({ port: 3000, host: 'localhost', debug: false })
    A.sub.ofAs<{ port: number; host: string; debug: boolean }>().on(result)
  })

  test('preserves undefined properties', () => {
    // NOTE: mergeDefaults preserves existing properties even if undefined
    const obj = { name: 'Alice', age: undefined }
    const defaults = { name: 'Unknown', age: undefined, city: 'NYC' }
    const result = Obj.mergeDefaults(obj, defaults)
    expect(result).toEqual({ name: 'Alice', age: undefined, city: 'NYC' })
  })
})

// ---- shallowMergeDefaults ----

describe('shallowMergeDefaults', () => {
  test('shallow merges with defaults', () => {
    const { defaults, config } = fixtures.withDefaults()
    const result = Obj.shallowMergeDefaults(defaults, config)
    expect(result).toEqual({ port: 3000, host: 'localhost', debug: false })
    A.sub.ofAs<{ port: number; host: string; debug: boolean }>().on(result)
  })

  test('later values override earlier ones', () => {
    const defaults = { a: 1, b: 2, c: 3 }
    const input = { b: 20 }
    const result = Obj.shallowMergeDefaults(defaults, input)
    expect(result).toEqual({ a: 1, b: 20, c: 3 })
  })
})

// ---- spreadShallow ----

describe('spreadShallow', () => {
  test('merges objects while omitting undefined values', () => {
    const { obj1, obj2 } = fixtures.withUndefined()
    const result = Obj.spreadShallow(obj1, obj2)
    expect(result).toEqual({ a: 1, b: 2, c: 4, d: 5 })
  })

  test('handles multiple objects', () => {
    const result = Obj.spreadShallow(
      { a: 1, b: 2 },
      { a: 1, b: undefined, c: 3 },
      { a: 1, b: 2, c: undefined, d: 4 },
    )
    expect(result).toEqual({ a: 1, b: 2, c: 3, d: 4 })
  })

  test('handles empty objects', () => {
    const { a, b } = fixtures.empty()
    const result = Obj.spreadShallow(a, b)
    expect(result).toEqual({})
  })

  test('merges empty with non-empty', () => {
    const result = Obj.spreadShallow({ a: 1 }, {})
    expect(result).toEqual({ a: 1 })
  })

  test('merges non-empty with empty', () => {
    const result = Obj.spreadShallow({}, { a: 1 })
    expect(result).toEqual({ a: 1 })
  })

  test('handles single object', () => {
    const result = Obj.spreadShallow({ a: 1, b: undefined, c: 3 })
    expect(result).toEqual({ a: 1, c: 3 })
  })

  test('handles no objects', () => {
    const result = Obj.spreadShallow()
    expect(result).toEqual({})
  })

  test('handles undefined objects in middle', () => {
    const result = Obj.spreadShallow(undefined, { a: 1, b: 2 }, undefined)
    expect(result).toEqual({ a: 1, b: 2 })
  })

  test('handles undefined at end', () => {
    const result = Obj.spreadShallow({ a: 1, b: 2 }, undefined)
    expect(result).toEqual({ a: 1, b: 2 })
  })

  test('handles all undefined', () => {
    const result = Obj.spreadShallow(undefined, undefined)
    expect(result).toEqual({})
  })

  test('preserves null values', () => {
    const { obj1, obj2 } = fixtures.withNull()
    const result = Obj.spreadShallow(obj1, obj2)
    expect(result).toEqual({ a: 1, b: 2, c: null })
  })

  test('preserves false and 0 values', () => {
    const result = Obj.spreadShallow({ a: true, b: 1 }, { a: false, b: 0 })
    expect(result).toEqual({ a: false, b: 0 })
  })

  test('property-based: never includes undefined values', () => {
    fc.assert(
      fc.property(
        fc.array(fc.dictionary(fc.string(), fc.option(fc.anything()))),
        (objects) => {
          const result = Obj.spreadShallow(...objects)
          Object.values(result).forEach(value => {
            expect(value).not.toBe(undefined)
          })
        },
      ),
    )
  })

  test('property-based: later objects override earlier ones', () => {
    fc.assert(
      fc.property(
        fc.object(),
        fc.object(),
        fc.string().filter(k => k !== '__proto__' && k !== 'constructor' && k !== 'prototype'),
        fc.anything().filter(v => v !== undefined),
        (obj1, obj2, key, value) => {
          obj1[key] = 'first'
          obj2[key] = value
          const result = Obj.spreadShallow(obj1, obj2) as any
          expect(result[key]).toBe(value)
        },
      ),
    )
  })

  test('protects against prototype pollution', () => {
    const maliciousObj = { '__proto__': { polluted: true } } as any
    const normalObj = { safe: 'value' }
    const result = Obj.spreadShallow(normalObj, maliciousObj)

    expect(Object.prototype.hasOwnProperty.call(result, '__proto__')).toBe(false)
    expect((Object.prototype as any).polluted).toBeUndefined()

    const constructorObj = { constructor: { polluted: true } } as any
    const result2 = Obj.spreadShallow(normalObj, constructorObj)
    expect(Object.prototype.hasOwnProperty.call(result2, 'constructor')).toBe(false)

    const prototypeObj = { prototype: { polluted: true } } as any
    const result3 = Obj.spreadShallow(normalObj, prototypeObj)
    expect(Object.prototype.hasOwnProperty.call(result3, 'prototype')).toBe(false)
  })
})

import { Fn } from '#fn'
import { describe, expect, test } from 'vitest'

describe('memo', () => {
  test('caches sync function results', () => {
    let callCount = 0
    const fn = Fn.memo((a: number, b: number) => {
      callCount++
      return a + b
    })

    expect(fn(1, 2)).toBe(3)
    expect(fn(1, 2)).toBe(3)
    expect(fn(1, 2)).toBe(3)
    expect(callCount).toBe(1)

    expect(fn(2, 3)).toBe(5)
    expect(callCount).toBe(2)
  })

  test('caches async function results', async () => {
    let callCount = 0
    const fn = Fn.memo(async (x: number) => {
      callCount++
      return x * 2
    })

    expect(await fn(5)).toBe(10)
    expect(await fn(5)).toBe(10)
    expect(callCount).toBe(1)

    expect(await fn(10)).toBe(20)
    expect(callCount).toBe(2)
  })

  test('uses JSON.stringify as default key', () => {
    let callCount = 0
    const fn = Fn.memo((obj: { a: number }) => {
      callCount++
      return obj.a
    })

    fn({ a: 1 })
    fn({ a: 1 }) // same JSON representation
    expect(callCount).toBe(1)

    fn({ a: 2 })
    expect(callCount).toBe(2)
  })

  test('key: null uses first argument directly', () => {
    let callCount = 0
    const obj1 = { id: 1 }
    const obj2 = { id: 1 } // same shape but different reference

    const fn = Fn.memo(
      (key: object) => {
        callCount++
        return key
      },
      { key: null },
    )

    fn(obj1)
    fn(obj1)
    expect(callCount).toBe(1)

    fn(obj2) // different reference = different key
    expect(callCount).toBe(2)
  })

  test('custom key function', () => {
    let callCount = 0
    const fn = Fn.memo(
      (user: { id: string; name: string }) => {
        callCount++
        return user.name
      },
      { key: ([user]) => user.id },
    )

    fn({ id: '1', name: 'Alice' })
    fn({ id: '1', name: 'Alice Updated' }) // same id = cached
    expect(callCount).toBe(1)

    fn({ id: '2', name: 'Bob' })
    expect(callCount).toBe(2)
  })

  test('cacheErrors: false (default) does not cache Error results', () => {
    let callCount = 0
    const fn = Fn.memo(() => {
      callCount++
      return new Error('test error')
    })

    fn()
    fn()
    fn()
    expect(callCount).toBe(3) // called each time
  })

  test('cacheErrors: true caches Error results', () => {
    let callCount = 0
    const fn = Fn.memo(
      () => {
        callCount++
        return new Error('test error')
      },
      { cacheErrors: true },
    )

    fn()
    fn()
    fn()
    expect(callCount).toBe(1) // cached after first call
  })

  test('thrown errors are not cached', () => {
    let callCount = 0
    const fn = Fn.memo(() => {
      callCount++
      throw new Error('thrown')
    })

    expect(() => fn()).toThrow('thrown')
    expect(() => fn()).toThrow('thrown')
    expect(callCount).toBe(2) // thrown errors bypass cache
  })

  test('async rejected promises are not cached', async () => {
    let callCount = 0
    const fn = Fn.memo(async () => {
      callCount++
      throw new Error('rejected')
    })

    await expect(fn()).rejects.toThrow('rejected')
    await expect(fn()).rejects.toThrow('rejected')
    expect(callCount).toBe(2)
  })

  test('weak: true uses WeakMap', () => {
    const fn = Fn.memo((obj: object) => obj, { weak: true, key: null })

    expect(fn.cache).toBeInstanceOf(WeakMap)
  })

  test('clear() empties the cache', () => {
    let callCount = 0
    const fn = Fn.memo((x: number) => {
      callCount++
      return x
    })

    fn(1)
    fn(1)
    expect(callCount).toBe(1)

    fn.clear()
    fn(1)
    expect(callCount).toBe(2)
  })

  test('clearKey() removes specific entry', () => {
    let callCount = 0
    const fn = Fn.memo((x: number) => {
      callCount++
      return x
    })

    fn(1)
    fn(2)
    expect(callCount).toBe(2)

    fn.clearKey('[1]') // JSON.stringify([1])
    fn(1)
    fn(2) // still cached
    expect(callCount).toBe(3)
  })

  test('shared cache between functions', () => {
    const sharedCache = new Map()
    let count1 = 0
    let count2 = 0

    const fn1 = Fn.memo(
      (x: number) => {
        count1++
        return x
      },
      { cache: sharedCache },
    )

    const fn2 = Fn.memo(
      (x: number) => {
        count2++
        return x * 2
      },
      { cache: sharedCache },
    )

    fn1(1) // caches key '[1]'
    expect(count1).toBe(1)

    fn2(1) // same key '[1]' - returns cached value from fn1!
    expect(count2).toBe(0) // fn2 was never called

    expect(fn2(1)).toBe(1) // returns fn1's cached result
  })

  test('caches undefined values correctly', () => {
    let callCount = 0
    const fn = Fn.memo(() => {
      callCount++
      return undefined
    })

    expect(fn()).toBe(undefined)
    expect(fn()).toBe(undefined)
    expect(callCount).toBe(1)
  })

  test('caches null values correctly', () => {
    let callCount = 0
    const fn = Fn.memo(() => {
      callCount++
      return null
    })

    expect(fn()).toBe(null)
    expect(fn()).toBe(null)
    expect(callCount).toBe(1)
  })
})

describe('memoWeak', () => {
  test('creates WeakMap-based memoization for object keys', () => {
    let callCount = 0
    const fn = Fn.memoWeak((obj: { value: number }) => {
      callCount++
      return obj.value * 2
    })

    const obj1 = { value: 5 }
    const obj2 = { value: 5 }

    expect(fn(obj1)).toBe(10)
    expect(fn(obj1)).toBe(10) // cached by reference
    expect(callCount).toBe(1)

    expect(fn(obj2)).toBe(10) // different reference
    expect(callCount).toBe(2)
  })

  test('uses WeakMap cache', () => {
    const fn = Fn.memoWeak((obj: object) => obj)
    expect(fn.cache).toBeInstanceOf(WeakMap)
  })
})

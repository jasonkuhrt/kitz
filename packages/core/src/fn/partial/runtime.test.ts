import { describe, expect, test } from 'vitest'
import { _, apply, defer, isHole, partial } from './runtime.js'

describe('partial', () => {
  // Test functions
  const add = (a: number, b: number) => a + b
  const add3 = (a: number, b: number, c: number) => a + b + c
  const greet = (greeting: string, name: string, punctuation: string) =>
    `${greeting}, ${name}${punctuation}`

  describe('hole symbol', () => {
    test('isHole identifies holes correctly', () => {
      expect(isHole(_)).toBe(true)
      expect(isHole(undefined)).toBe(false)
      expect(isHole(null)).toBe(false)
      expect(isHole(0)).toBe(false)
      expect(isHole('')).toBe(false)
      expect(isHole(Symbol())).toBe(false)
    })

    test('hole symbol is a singleton', () => {
      expect(_).toBe(_)
      expect(_).toBe(Symbol.for('kit.partial.hole'))
    })
  })

  describe('basic partial application', () => {
    test('defer first arg', () => {
      const result = partial(add, _, 2)
      expect(typeof result).toBe('function')
      expect(result(1)).toBe(3)
    })

    test('defer second arg', () => {
      const result = partial(add, 1, _)
      expect(typeof result).toBe('function')
      expect(result(2)).toBe(3)
    })

    test('no holes - execute immediately', () => {
      const result = partial(add, 1, 2)
      expect(result).toBe(3)
    })
  })

  describe('multiple holes', () => {
    test('all holes', () => {
      const fn = partial(add3, _, _, _)
      expect(fn(1, 2, 3)).toBe(6)
    })

    test('first and last', () => {
      const fn = partial(add3, _, 2, _)
      expect(fn(1, 3)).toBe(6)
    })

    test('middle hole', () => {
      const fn = partial(add3, 1, _, 3)
      expect(fn(2)).toBe(6)
    })

    test('last two holes', () => {
      const fn = partial(add3, 1, _, _)
      expect(fn(2, 3)).toBe(6)
    })
  })

  describe('string example', () => {
    test('casual greeting', () => {
      const fn = partial(greet, 'Hey', _, '!')
      expect(fn('Alice')).toBe('Hey, Alice!')
    })

    test('formal greeting', () => {
      const fn = partial(greet, 'Hello', _, '.')
      expect(fn('Dr. Smith')).toBe('Hello, Dr. Smith.')
    })

    test('question format', () => {
      const fn = partial(greet, _, 'Bob', '?')
      expect(fn('Where are you')).toBe('Where are you, Bob?')
    })
  })

  describe('edge cases', () => {
    test('single parameter function with hole', () => {
      const identity = (x: number) => x
      const deferred = partial(identity, _)
      expect(deferred(42)).toBe(42)
    })

    test('single parameter function without hole', () => {
      const identity = (x: number) => x
      const result = partial(identity, 42)
      expect(result).toBe(42)
    })

    test('preserves this context', () => {
      const obj = {
        value: 10,
        add(x: number) {
          return this.value + x
        },
      }
      const addToObj = partial(obj.add.bind(obj), _)
      expect(addToObj(5)).toBe(15)
    })
  })

  describe('complex types', () => {
    test('objects and arrays', () => {
      const merge = (a: { x: number }, b: { y: number }) => ({ ...a, ...b })
      const withY = partial(merge, _, { y: 2 })
      expect(withY({ x: 1 })).toEqual({ x: 1, y: 2 })
    })

    test('functions as arguments', () => {
      const applyFn = (fn: (x: number) => number, value: number) => fn(value)
      const applyDouble = partial(applyFn, (x: number) => x * 2, _)
      expect(applyDouble(5)).toBe(10)
    })
  })
})

describe('apply (alias)', () => {
  test('works identically to partial', () => {
    const add = (a: number, b: number) => a + b
    const addOne = apply(add, _, 1)
    expect(addOne(5)).toBe(6)
  })
})

describe('defer', () => {
  test('creates a thunk', () => {
    let called = false
    const fn = (a: number, b: number) => {
      called = true
      return a + b
    }

    const deferred = defer(fn, 1, 2)
    expect(called).toBe(false)
    expect(typeof deferred).toBe('function')

    const result = deferred()
    expect(called).toBe(true)
    expect(result).toBe(3)
  })

  test('preserves arguments', () => {
    const fn = (...args: number[]) => args
    const deferred = defer(fn, 1, 2, 3, 4, 5)
    expect(deferred()).toEqual([1, 2, 3, 4, 5])
  })
})

import { property } from '#kitz/test/test'
import fc from 'fast-check'
import { expect, test } from 'vitest'
import { Fn } from './_.js'

property(
  'is detects functions',
  fc.oneof(
    fc.func(fc.anything()),
    fc.anything().filter(v => typeof v !== 'function'),
  ),
  (value) => {
    expect(Fn.is(value)).toBe(typeof value === 'function')
  },
)

property('identity returns same value', fc.anything(), (value) => {
  expect(Fn.identity(value)).toBe(value)
})

property('constant creates constant function', fc.anything(), (value) => {
  const fn = Fn.constant(value)
  expect(fn()).toBe(value)
  expect(fn()).toBe(value)
})

test('noop returns undefined', () => {
  expect(Fn.noop()).toBeUndefined()
})

property('bind fixes first argument', fc.integer(), fc.integer(), fc.integer(), (a, b, _c) => {
  const add = (x: number, y: number) => x + y
  const bound = Fn.bind(add, a)
  expect(bound(b)).toBe(a + b)
})

property('curry creates curried function', fc.integer(), fc.integer(), (a, b) => {
  const add = (x: number, y: number) => x + y
  const curried = Fn.curry(add)
  expect(curried(a)(b)).toBe(add(a, b))
})

test('uncurry returns function', () => {
  const curried = (a: number) => (b: number) => a + b
  const uncurried = Fn.uncurry(curried)
  expect(typeof uncurried).toBe('function')
})

property(
  'flipCurried reverses argument order',
  fc.integer().filter(x => x !== 0),
  fc.integer().filter(x => x !== 0),
  (a, b) => {
    const divide = (x: number) => (y: number) => x / y
    const flipped = Fn.flipCurried(divide)
    expect(flipped(a)(b)).toBe(divide(b)(a))
  },
)

property(
  'pipe composes functions left to right',
  fc.integer(),
  fc.array(fc.func(fc.integer()), { minLength: 0, maxLength: 4 }),
  (value, fns) => {
    // Since pipe only has overloads for up to 4 functions, we need to call it differently
    let result: any
    if (fns.length === 0) {
      result = Fn.pipe(value)
    } else if (fns.length === 1) {
      result = Fn.pipe(value, fns[0]!)
    } else if (fns.length === 2) {
      result = Fn.pipe(value, fns[0]!, fns[1]!)
    } else if (fns.length === 3) {
      result = Fn.pipe(value, fns[0]!, fns[1]!, fns[2]!)
    } else if (fns.length === 4) {
      result = Fn.pipe(value, fns[0]!, fns[1]!, fns[2]!, fns[3]!)
    }
    const expected = fns.reduce((acc, fn) => fn(acc), value)
    expect(result).toBe(expected)
  },
)

test('pipe type transformations', () => {
  const result = Fn.pipe(5, x => x + 1, x => x * 2, x => x.toString())
  expect(result).toBe('12')
})

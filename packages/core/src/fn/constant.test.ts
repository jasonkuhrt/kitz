import { Fn } from '#fn'
import { Assert } from '#kitz/assert'
import { Test } from '#kitz/test'
import fc from 'fast-check'
import { expect, test } from 'vitest'

const A = Assert.Type.exact.ofAs

Test.property('returns a function that always returns the initial value', fc.anything(), (value) => {
  const constantFn = Fn.constant(value)
  // Call multiple times to ensure consistency
  expect(constantFn()).toBe(value)
  expect(constantFn()).toBe(value)
  expect(constantFn()).toBe(value)
})

Test.property(
  'preserves reference equality for objects',
  fc.oneof(fc.object(), fc.array(fc.anything())),
  (value) => {
    const constantFn = Fn.constant(value)
    const result1 = constantFn()
    const result2 = constantFn()
    expect(result1).toBe(result2)
    expect(result1).toBe(value)
  },
)

Test.property(
  'returned function is pure (no arguments affect output)',
  fc.anything(),
  fc.array(fc.anything(), { minLength: 1, maxLength: 5 }),
  (value, args) => {
    const constantFn = Fn.constant(value)
    // Even if we pass arguments, the result should be the same
    args.forEach(arg => {
      expect((constantFn as any)(arg)).toBe(value)
    })
  },
)

test('type: preserves value types in returned function', () => {
  const constantNumber = Fn.constant(42)
  A<() => number>().on(constantNumber)
  A<number>().on(constantNumber())

  const constantString = Fn.constant('hello')
  A<() => string>().on(constantString)
  A<string>().on(constantString())

  const obj = { a: 1 } as const
  const constantObj = Fn.constant(obj)
  A<() => { readonly a: 1 }>().on(constantObj)
  A<{ readonly a: 1 }>().on(constantObj())
})

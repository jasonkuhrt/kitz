import { Test } from '#kitz/test'
import { Obj } from '#obj'
import * as fc from 'fast-check'
import { expect, test } from 'vitest'

const testObj = { a: 1, b: 2, c: 3, d: 4 }

Test.on(Obj.policyFilter)
  .cases(
    [['allow', testObj, ['a', 'c']], { a: 1, c: 3 }],
    [['allow', testObj, []], {}],
    [['allow', testObj, ['a', 'z']], { a: 1 }],
    [['deny', testObj, ['a', 'c']], { b: 2, d: 4 }],
    [['deny', testObj, []], { a: 1, b: 2, c: 3, d: 4 }],
    [['deny', testObj, ['z']], { a: 1, b: 2, c: 3, d: 4 }],
  )
  .test()

test('policyFilter preserves undefined values', () => {
  const obj = { a: 1, b: undefined, c: 3 }
  expect(Obj.policyFilter('allow', obj, ['a', 'b'])).toEqual({ a: 1, b: undefined })
})

Test.on((obj: Record<string, number>) => Obj.pick(obj, (_k, v: number) => v > 2))
  .cases(
    [[testObj], { c: 3, d: 4 }],
  )
  .test()

Test.on((obj: Record<string, number>) => Obj.pick(obj, k => k === 'a' || k === 'c'))
  .cases(
    [[testObj], { a: 1, c: 3 }],
  )
  .test()

Test.on((obj: Record<string, number>) =>
  Obj.pick(obj, (_k, v: number, o?: Record<string, number>) => {
    const avg = Object.values(o!).reduce((a: number, b: number) => a + b, 0) / Object.keys(o!).length
    return v < avg
  })
)
  .cases([[testObj], { a: 1, b: 2 }])
  .test()

Test.on((obj: Record<string, number>) => Obj.pick(obj, () => false))
  .cases(
    [[testObj], {}],
  )
  .test()

Test.on((obj: Record<string, number>) => Obj.pick(obj, () => true))
  .cases(
    [[testObj], { a: 1, b: 2, c: 3, d: 4 }],
    [[{}], {}],
  )
  .test()

Test.on((obj: Record<string, number>, keys: readonly string[]) => Obj.partition(obj, keys))
  .cases(
    [[{ a: 1, b: 2, c: 3, d: 4 }, ['a', 'c']], { picked: { a: 1, c: 3 }, omitted: { b: 2, d: 4 } }],
    [[{ a: 1, b: 2 }, []], { picked: {}, omitted: { a: 1, b: 2 } }],
    [[{ a: 1, b: 2 }, ['a', 'z']], { picked: { a: 1 }, omitted: { b: 2 } }],
  )
  .test()

test('policyFilter allow/deny are complementary', () => {
  fc.assert(
    fc.property(
      fc.dictionary(fc.string(), fc.anything()),
      fc.array(fc.string()),
      (obj, keys) => {
        // Filter out prototype pollution keys
        const safeObj = Object.fromEntries(
          Object.entries(obj).filter(([k]) =>
            ![
              '__proto__',
              'constructor',
              'prototype',
              'valueOf',
              'toString',
              'hasOwnProperty',
              'isPrototypeOf',
              'propertyIsEnumerable',
              'toLocaleString',
            ].includes(k)
          ),
        )
        const safeKeys = keys.filter(k =>
          ![
            '__proto__',
            'constructor',
            'prototype',
            'valueOf',
            'toString',
            'hasOwnProperty',
            'isPrototypeOf',
            'propertyIsEnumerable',
            'toLocaleString',
          ].includes(k)
        )

        const allowed = Obj.policyFilter('allow', safeObj, safeKeys)
        const denied = Obj.policyFilter('deny', safeObj, safeKeys)

        // Every own key in obj is either in allowed or denied, never both
        Object.keys(safeObj).forEach(key => {
          const inAllowed = Object.prototype.hasOwnProperty.call(allowed, key)
          const inDenied = Object.prototype.hasOwnProperty.call(denied, key)
          expect(inAllowed).toBe(!inDenied)
        })

        // Combined they reconstruct the original object
        expect({ ...allowed, ...denied }).toEqual(safeObj)
      },
    ),
  )
})

test('pick with predicate preserves values unchanged', () => {
  fc.assert(
    fc.property(
      fc.dictionary(fc.string(), fc.anything()),
      (obj) => {
        // Filter out prototype pollution keys
        const safeObj = Object.fromEntries(
          Object.entries(obj).filter(([k]) => !['__proto__', 'constructor', 'prototype'].includes(k)),
        )

        const filtered = Obj.pick(safeObj, () => true)
        expect(filtered).toEqual(safeObj)

        // Values are the same reference
        Object.keys(filtered).forEach(key => {
          expect(filtered[key]).toBe(safeObj[key])
        })
      },
    ),
  )
})

test('policyFilter is immutable', () => {
  fc.assert(
    fc.property(
      fc.dictionary(fc.string(), fc.anything()),
      fc.array(fc.string()),
      fc.oneof(fc.constant('allow' as const), fc.constant('deny' as const)),
      (obj, keys, mode) => {
        const original = { ...obj }
        Obj.policyFilter(mode, obj, keys)
        expect(obj).toEqual(original)
      },
    ),
  )
})

test('empty keys behavior', () => {
  fc.assert(
    fc.property(
      fc.dictionary(fc.string(), fc.anything()),
      (obj) => {
        expect(Obj.policyFilter('allow', obj, [])).toEqual({})
        expect(Obj.policyFilter('deny', obj, [])).toEqual(obj)
      },
    ),
  )
})

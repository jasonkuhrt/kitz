import { Test } from '#kitz/test'
import { property } from '#kitz/test/test'
import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { Prom } from './_.js'

describe('isShape', () => {
  // test('detects promises and thenables', () => {
  //   expect(Prom.isShape(Promise.resolve(42))).toBe(true)
  //   // eslint-disable-next-line unicorn/no-thenable
  //   expect(Prom.isShape({ then: () => {}, catch: () => {}, finally: () => {} })).toBe(true)
  //   // eslint-disable-next-line unicorn/no-thenable
  //   expect(Prom.isShape({ then: () => {} })).toBe(false)
  //   // eslint-disable-next-line unicorn/no-thenable
  //   expect(Prom.isShape({ then: 'not a function', catch: () => {}, finally: () => {} })).toBe(false)
  // })
  Test
    .on(Prom.isShape)
    .describe('true', [
      [[Promise.resolve(42)], true],
      [[{ then() {}, catch() {}, finally() {} }], true],
    ])
    .describe('false', [
      [[{ then() {} }], false],
      [[{ then: 'not a function', catch() {}, finally() {} }], false],
    ])
    .test()

  property(
    'rejects non-promise values',
    fc.oneof(fc.integer(), fc.string(), fc.boolean(), fc.constant(null), fc.constant(undefined), fc.object()),
    (value) => {
      expect(Prom.isShape(value)).toBe(false)
    },
  )
})

describe('createDeferred', () => {
  Test
    .describe('state tracking')
    .onSetup(() => ({
      d: Prom.createDeferred<number>(),
    }))
    .outputDefault(({ d }) => d)
    .case('initial', () => {})
    .case('after resolve', ({ d }) => {
      d.resolve(1)
    })
    .case('after reject', ({ d }) => {
      d.reject(new Error('test'))
      d.promise.catch(() => {}) // Prevent unhandled rejection
    })
    .test()

  Test
    .describe('strict')
    .onSetup(() => ({
      d: Prom.createDeferred<number>({ strict: true }),
    }))
    .outputDefault(({ d }) => d)
    .case('resolve resolve calls throw', ({ d }) => {
      d.resolve(1)
      d.resolve(1)
    })
    .case('resolve reject calls throw', ({ d }) => {
      d.reject(new Error('test'))
      d.promise.catch(() => {}) // Prevent unhandled rejection
      d.resolve(1)
    })
    .case('reject resolve calls throw', ({ d }) => {
      d.reject(new Error('test'))
      d.promise.catch(() => {}) // Prevent unhandled rejection
      d.resolve(1)
    })
    .test()

  test('destructuring', () => {
    const d = Prom.createDeferred<number>()
    const { isResolved, isRejected, isSettled } = d
    expect({ isResolved, isRejected, isSettled }).toEqual({ isResolved: false, isRejected: false, isSettled: false })
  })
})

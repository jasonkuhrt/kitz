import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { ensure, is, isAggregateError } from './type.js'

describe('is', () => {
  test('returns true for any Error instance', () => {
    fc.assert(
      fc.property(fc.string(), (message) => {
        expect(is(new Error(message))).toBe(true)
        expect(is(new TypeError(message))).toBe(true)
        expect(is(new RangeError(message))).toBe(true)
        expect(is(new AggregateError([], message))).toBe(true)
      }),
    )
  })

  test('returns false for any non-Error value', () => {
    fc.assert(
      fc.property(
        fc.anything().filter((v) => !(v instanceof Error)),
        (value) => {
          expect(is(value)).toBe(false)
        },
      ),
    )
  })
})

describe('isAggregateError', () => {
  test('returns true only for AggregateError instances', () => {
    fc.assert(
      fc.property(fc.array(fc.string()), fc.string(), (errors, message) => {
        const aggregateError = new AggregateError(
          errors.map((e) => new Error(e)),
          message,
        )
        expect(isAggregateError(aggregateError)).toBe(true)
      }),
    )
  })

  test('returns false for other Error types', () => {
    fc.assert(
      fc.property(fc.string(), (message) => {
        expect(isAggregateError(new Error(message))).toBe(false)
        expect(isAggregateError(new TypeError(message))).toBe(false)
        expect(isAggregateError(new RangeError(message))).toBe(false)
      }),
    )
  })

  test('returns false for non-Error values', () => {
    fc.assert(
      fc.property(
        fc.anything().filter((v) => !(v instanceof Error)),
        (value) => {
          expect(isAggregateError(value)).toBe(false)
        },
      ),
    )
  })
})

describe('ensure', () => {
  test('preserves Error instances', () => {
    fc.assert(
      fc.property(fc.string(), (message) => {
        const error = new Error(message)
        expect(ensure(error)).toBe(error)

        const typeError = new TypeError(message)
        expect(ensure(typeError)).toBe(typeError)
      }),
    )
  })

  test('converts any non-Error value to Error', () => {
    fc.assert(
      fc.property(
        fc.anything().filter((v) => !(v instanceof Error)),
        (value) => {
          const result = ensure(value)
          expect(result).toBeInstanceOf(Error)

          // Handle edge cases where String() might fail
          try {
            expect(result.message).toBe(String(value))
          } catch {
            expect(result.message).toBe('[Unrepresentable value]')
          }
        },
      ),
    )
  })
})

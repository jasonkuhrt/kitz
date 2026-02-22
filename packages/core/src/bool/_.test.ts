import { property } from '#kitz/test/test'
import fc from 'fast-check'
import { expect, test } from 'vitest'
import { Bool } from './_.js'

property('not negates booleans', fc.boolean(), (value) => {
  expect(Bool.not(value)).toBe(!value)
})

property('negate creates negated predicate', fc.func(fc.boolean()), fc.anything(), (pred, value) => {
  const negated = Bool.negate(pred)
  expect(negated(value)).toBe(!pred(value))
})

test('ensurePredicate handles functions and values', () => {
  const fn = (n: number) => n > 0
  expect((Bool.ensurePredicate(fn) as any)(5)).toBe(true)
  expect((Bool.ensurePredicate(true) as any)('any')).toBe(true)
  expect((Bool.ensurePredicate(false) as any)('any')).toBe(false)
})

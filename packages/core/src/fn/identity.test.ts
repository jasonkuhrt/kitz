import { Fn } from '#fn'
import { Type as A } from '#kitz/assert/assert'
import { Test } from '#kitz/test'
import { Ts } from '#ts'
import fc from 'fast-check'
import { expect, test } from 'vitest'

Test.property('returns input unchanged for any value', fc.anything(), (value) => {
  expect(Fn.identity(value)).toBe(value)
})

Test.property('preserves object references', fc.oneof(fc.object(), fc.array(fc.anything())), (value) => {
  expect(Fn.identity(value)).toBe(value)
})

test('type: preserves input types', () => {
  A.exact.ofAs<0>().on(Fn.identity(0))
  A.exact.ofAs<''>().on(Fn.identity(''))
  A.exact.ofAs<true>().on(Fn.identity(true))
  A.exact.ofAs<null>().on(Fn.identity(null))
  A.exact.ofAs<undefined>().on(Fn.identity(undefined))
  A.sub.ofAs<{ readonly a: 1 }>().on(Fn.identity({ a: 1 } as const))
})

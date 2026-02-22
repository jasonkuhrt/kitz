import { Assert } from '#kitz/assert'
import { property } from '#kitz/test/test'
import { Null } from '#null'
import fc from 'fast-check'
import { expect, test } from 'vitest'

const A = Assert.Type.exact.ofAs

test('null detection', () => {
  expect(Null.is(null)).toBe(true)
  expect(!Null.is(null)).toBe(false)
  expect(Null.is(undefined)).toBe(false)
})

property('is returns true only for null', fc.anything(), (value) => {
  expect(Null.is(value)).toBe(value === null)
})

property('filters nulls', fc.array(fc.option(fc.anything())), (arr) => {
  expect(arr.filter(v => !Null.is(v)).every(v => v !== null)).toBe(true)
})

test('type narrowing', () => {
  const value = 'hello' as string | null
  if (Null.is(value)) A<null>().on(value)
  else A<string>().on(value)
})

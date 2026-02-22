import { Assert } from '#kitz/assert'
import { property } from '#kitz/test/test'
import { Undefined } from '#undefined'
import fc from 'fast-check'
import { expect, test } from 'vitest'

const A = Assert.Type.exact.ofAs

test('undefined detection', () => {
  expect(Undefined.is(undefined)).toBe(true)
  expect(!Undefined.is(undefined)).toBe(false)
  expect(Undefined.is(null)).toBe(false)
})

property('is returns true only for undefined', fc.anything(), (value) => {
  expect(Undefined.is(value)).toBe(value === undefined)
})

property('filters undefined', fc.array(fc.option(fc.anything())), (arr) => {
  const withUndefined = arr.map(v => v === null ? undefined : v)
  expect(withUndefined.filter(v => !Undefined.is(v)).every(v => v !== undefined)).toBe(true)
})

test('type narrowing', () => {
  const value = 'hello' as string | undefined
  if (Undefined.is(value)) A<undefined>().on(value)
  else A<string>().on(value)
})

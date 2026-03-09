import { property } from '#kitz/test/test'
import fc from 'fast-check'
import { expect, test } from 'vitest'
import { Value } from './_.js'

property('lazy wraps any value in a function', fc.anything(), (value) => {
  const lazy = Value.lazy(value)
  expect(typeof lazy).toBe('function')
  expect(lazy()).toEqual(value)
})

property('resolveLazy unwraps lazy values', fc.anything(), (value) => {
  expect(Value.resolveLazy(value)).toEqual(value)
  expect(Value.resolveLazy(() => value)).toEqual(value)
})

test('resolveLazy preserves nested functions', () => {
  const nested = () => () => 'nested'
  expect(typeof Value.resolveLazy(nested)).toBe('function')
  expect(Value.resolveLazy(nested)()).toBe('nested')
})

property('resolveLazyFactory creates value factory', fc.anything(), (value) => {
  const factory1 = Value.resolveLazyFactory(value)
  const factory2 = Value.resolveLazyFactory(() => value)

  expect(factory1()).toEqual(value)
  expect(factory2()).toEqual(value)
})

test('resolveLazyFactory calls lazy function each time', () => {
  let count = 0
  const factory = Value.resolveLazyFactory(() => ++count)

  expect(factory()).toBe(1)
  expect(factory()).toBe(2)
  expect(factory()).toBe(3)
})

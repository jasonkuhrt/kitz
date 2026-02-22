import { Test } from '#kitz/test'
import { describe, expect, test } from 'vitest'
import { Arr } from './_.js'

Test.on(Arr.transpose<number>)
  .cases(
    [[[[1, 2, 3], [4, 5, 6]]], [[1, 4], [2, 5], [3, 6]]],
    [[[[1, 2], [3, 4], [5, 6]]], [[1, 3, 5], [2, 4, 6]]],
    [[[[1, 2, 3], [4, 5]]], [[1, 4], [2, 5], [3]]],
    [[[[]]], []],
  )
  .test()

describe('polymorphic dispatch preserves frozen status', () => {
  const frozen = Object.freeze
  const isFrozen = Object.isFrozen

  test('map', () => {
    expect(isFrozen(Arr.map([1], (x) => x))).toBe(false)
    expect(isFrozen(Arr.map(frozen([1]), (x) => x))).toBe(true)
  })

  test('dedupe', () => {
    const mut = [1, 1]
    expect(Arr.dedupe(mut)).toBe(mut) // in-place
    expect(isFrozen(Arr.dedupe(frozen([1, 1])))).toBe(true)
  })

  test('transpose', () => {
    expect(isFrozen(Arr.transpose([[1]]))).toBe(false)
    expect(isFrozen(Arr.transpose(frozen([[1]])))).toBe(true)
  })

  test('merge', () => {
    expect(isFrozen(Arr.merge([1], [2]))).toBe(false)
    expect(isFrozen(Arr.merge(frozen([1]), [2]))).toBe(true)
    expect(isFrozen(Arr.merge([1], frozen([2])))).toBe(true)
  })

  test('partition', () => {
    const isNum = (x: unknown): x is number => typeof x === 'number'
    const [a, b] = Arr.partition([1, 'x'], isNum)
    expect(isFrozen(a)).toBe(false)
    const [c, d] = Arr.partition(frozen([1, 'x']), isNum)
    expect(isFrozen(c)).toBe(true)
    expect(isFrozen(d)).toBe(true)
  })

  test('partitionErrors', () => {
    const [v1] = Arr.partitionErrors([1, new Error()])
    expect(isFrozen(v1)).toBe(false)
    const [v2, e2] = Arr.partitionErrors(frozen([1, new Error()]))
    expect(isFrozen(v2)).toBe(true)
    expect(isFrozen(e2)).toBe(true)
  })
})

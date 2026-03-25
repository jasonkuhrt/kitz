import { describe, expect, test } from 'vitest'
import {
  assert,
  create,
  dedupe,
  empty,
  ensure,
  equalShallowly,
  find,
  findFirstMatching,
  getAt,
  getFirst,
  getLast,
  getRandomly,
  includes,
  includesUnknown,
  isEmpty,
  isntEmpty,
  join,
  joinOn,
  joinWith,
  last,
  map,
  mapOn,
  mapWith,
  merge,
  mergeOn,
  of,
  partition,
  partitionErrors,
  partitionOne,
  randomIndex,
  sure,
  transpose,
} from './arr.js'

describe('arr coverage', () => {
  test('covers construction and access helpers', () => {
    expect(empty).toEqual([])
    expect(Object.isFrozen(empty)).toBe(true)

    const frozen = of(1, 2, 3)
    expect(frozen).toEqual([1, 2, 3])
    expect(Object.isFrozen(frozen)).toBe(true)

    assert([1, 2, 3])
    expect(() => assert('oak')).toThrow('Expected array')

    expect(isEmpty([])).toBe(true)
    expect(isEmpty([1])).toBe(false)
    expect(isntEmpty([1])).toBe(true)
    expect(isntEmpty([])).toBe(false)

    const created = create<number>()
    created.push(1, 2)
    expect(created).toEqual([1, 2])

    expect(ensure('oak')).toEqual(['oak'])
    expect(ensure(['oak'])).toEqual(['oak'])
    expect(sure('oak')).toEqual(['oak'])
    expect(sure(['oak'])).toEqual(['oak'])

    expect(getAt(['a', 'b', 'c'], 1)).toBe('b')
    expect(getAt(['a', 'b', 'c'], 10)).toBeUndefined()
    expect(getFirst([1, 2, 3])).toBe(1)
    expect(getFirst([])).toBeUndefined()
    expect(getLast([1, 2, 3])).toBe(3)
    expect(last([1, 2, 3])).toBe(3)
    expect(getLast([])).toBeUndefined()
  })

  test('covers random, search, and comparison helpers', () => {
    expect(randomIndex([])).toBeUndefined()
    const index = randomIndex([1, 2, 3])
    expect(index).toBeGreaterThanOrEqual(0)
    expect(index).toBeLessThan(3)

    expect(getRandomly([])).toBeUndefined()
    expect([1, 2, 3]).toContain(getRandomly([1, 2, 3]))

    expect(includes(['oak', 'pine'], 'oak')).toBe(true)
    expect(includes(['oak', 'pine'], 'birch')).toBe(false)
    expect(includesUnknown(['oak', 'pine'], 'pine')).toBe(true)

    expect(find([1, 2, 3], (value) => value > 1)).toBe(2)
    expect(find(['a', 'b', 'c'], 'b')).toBe('b')
    expect(find(['a', 'b', 'c'], 'z')).toBeUndefined()
    expect(findFirstMatching(['hello', 'world'], /^w/)).toBe('world')

    expect(equalShallowly([1, 2, 3], [1, 2, 3])).toBe(true)
    expect(equalShallowly([1, 2], [1, 3])).toBe(false)
  })

  test('covers transformation helpers', () => {
    expect(map([1, 2, 3], (value, index) => value + index)).toEqual([1, 3, 5])
    expect(Object.isFrozen(map(of(1, 2), (value) => value * 2))).toBe(true)
    expect(mapOn([1, 2, 3])((value) => value * 2)).toEqual([2, 4, 6])
    expect(mapWith((value: number) => value * 3)([1, 2, 3])).toEqual([3, 6, 9])

    expect(
      transpose([
        [1, 2, 3],
        [4, 5],
      ]),
    ).toEqual([
      [1, 4],
      [2, 5],
      [3],
    ])

    const mutable = [1, 2, 2, 3]
    expect(dedupe(mutable)).toBe(mutable)
    expect(mutable).toEqual([1, 2, 3])

    const dedupedFrozen = dedupe(of(1, 1, 2, 2))
    expect(dedupedFrozen).toEqual([1, 2])
    expect(Object.isFrozen(dedupedFrozen)).toBe(true)
  })

  test('covers partitioning and joining helpers', () => {
    const [odds, evens] = partition(of(1, 2, 3, 4), (value): value is number => value % 2 === 0)
    expect(odds).toEqual([1, 3])
    expect(evens).toEqual([2, 4])
    expect(Object.isFrozen(odds)).toBe(true)
    expect(Object.isFrozen(evens)).toBe(true)

    expect(partitionOne([1, 2, 3], (value): value is number => value === 2)).toEqual([[1, 3], 2])
    expect(() =>
      partitionOne([1, 2, 3], (value): value is number => value > 1),
    ).toThrow('Expected at most one item to match predicate')

    const error1 = new Error('one')
    const error2 = new Error('two')
    expect(partitionErrors([1, error1, 'oak', error2])).toEqual([[1, 'oak'], [error1, error2]])

    expect(join(['a', 'b', 'c'], ',')).toBe('a,b,c')
    expect(joinOn(['a', 'b', 'c'])(' | ')).toBe('a | b | c')
    expect(joinWith(' / ')(['a', 'b', 'c'])).toBe('a / b / c')
  })

  test('covers merge helpers', () => {
    expect(merge([1, 2], [3, 4])).toEqual([1, 2, 3, 4])
    expect(mergeOn([1, 2])([3, 4])).toEqual([1, 2, 3, 4])

    const mergedFrozen = merge(of(1, 2), [3, 4])
    expect(mergedFrozen).toEqual([1, 2, 3, 4])
    expect(Object.isFrozen(mergedFrozen)).toBe(true)
  })
})

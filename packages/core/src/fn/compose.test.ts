import { Test } from '#kitz/test'
import type { Optic } from '#optic'
import { describe, expect, test } from 'vitest'
import { compose, compose2 } from './compose.js'
import type { Extractor } from './extractor.js'

// Regular function composition
const add1 = (x: number) => x + 1
const double = (x: number) => x * 2
const toString = (x: number) => x.toString()

const composedTwo = compose(add1, double)
const composedThree = compose(toString, add1, double) as (x: number) => string
const composedSingle = compose(double) as (x: number) => number

Test.describe('compose > two functions')
  .on(composedTwo)
  .cases([[5], 11], [[10], 21], [[0], 1])
  .test()

Test.describe('compose > three functions')
  .on(composedThree)
  .cases([[5], '11'], [[10], '21'], [[0], '1'])
  .test()

Test.describe('compose > single function (identity)')
  .on(composedSingle)
  .cases([[5], 10], [[0], 0], [[-1], -2])
  .test()

test('compose > empty throws', () => {
  expect(() => compose()).toThrow('compose requires at least one function')
})

// Extractor composition
describe('compose > extractors', () => {
  test('composes extractors and preserves .kind metadata', () => {
    const extractor1: Extractor<number, string> = Object.assign(
      (x: number) => x.toString(),
      { kind: {} as Optic.Returned.$Get },
    )

    const extractor2: Extractor<boolean, number> = Object.assign(
      (x: boolean) => (x ? 1 : 0),
      { kind: {} as Optic.Awaited.$Get },
    )

    const composed = compose(extractor1, extractor2)

    expect(composed(true)).toBe('1')
    expect(composed(false)).toBe('0')
    expect(composed).toHaveProperty('kind')
  })

  test('composes multiple extractors', () => {
    const ext1: Extractor<number, number> = Object.assign((x: number) => x * 2, { kind: {} as Optic.Returned.$Get })
    const ext2: Extractor<number, number> = Object.assign((x: number) => x + 1, { kind: {} as Optic.Awaited.$Get })
    const ext3: Extractor<number, number> = Object.assign((x: number) => x - 3, { kind: {} as Optic.Array.$Get })

    const composed = compose(ext1, ext2, ext3)

    expect(composed(5)).toBe(6)
    expect(composed).toHaveProperty('kind')
  })
})

// compose2
const composed2Two = compose2(add1, double)

Test.describe('compose2 > functions')
  .on(composed2Two)
  .cases([[5], 11], [[10], 21])
  .test()

describe('compose2 > extractors', () => {
  test('composes two extractors with .kind metadata', () => {
    const ext1: Extractor<number, string> = Object.assign(
      (x: number) => x.toString(),
      { kind: {} as Optic.Returned.$Get },
    )

    const ext2: Extractor<boolean, number> = Object.assign(
      (x: boolean) => (x ? 1 : 0),
      { kind: {} as Optic.Awaited.$Get },
    )

    const composed = compose2(ext1, ext2)

    expect(composed(true)).toBe('1')
    expect(composed).toHaveProperty('kind')
  })
})

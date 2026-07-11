import { describe, expect, expectTypeOf, it } from '@kitz/vitest'
import { Tuple } from './_.js'

describe('effect/Tuple passthrough', () => {
  it('re-exports effect tuple utilities unchanged', () => {
    const pair = Tuple.make('a', 42)
    expect(pair).toEqual(['a', 42])
    expectTypeOf(pair).toEqualTypeOf<[string, number]>()
  })
})

describe('Last', () => {
  it('extracts tuple tails and returns never for an empty tuple', () => {
    expectTypeOf<Tuple.Last<readonly ['a', 'b']>>().toEqualTypeOf<'b'>()
    expectTypeOf<Tuple.Last<[42]>>().toEqualTypeOf<42>()
    expectTypeOf<Tuple.Last<[]>>().toEqualTypeOf<never>()
  })

  it('extracts an explicit element after a tuple rest', () => {
    expectTypeOf<Tuple.Last<[...string[], number]>>().toEqualTypeOf<number>()
  })

  it('rejects non-array inputs', () => {
    // @ts-expect-error Last is defined only for readonly tuple and array inputs
    expectTypeOf<Tuple.Last<string>>()
  })
})

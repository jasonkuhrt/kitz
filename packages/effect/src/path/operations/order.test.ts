import { describe, expect, expectTypeOf, it } from '@kitz/vitest'
import { Equal, Schema as S } from 'effect'
import { FastCheck } from 'effect/testing'
import * as Path from '../__.js'

const arb = {
  Any: S.toArbitrary(Path.Any),
} as const
const sign = (value: number): -1 | 0 | 1 => (value < 0 ? -1 : value > 0 ? 1 : 0)

describe('order', () => {
  it('accepts path literals and obeys the decode desugar law', () => {
    // @ts-expect-error RED-PIN: order operands do not yet have literal duality
    const literalResult = Path.order('/a/', '/b/')
    const decodedResult = Path.order(S.decodeSync(Path.Any)('/a/'), S.decodeSync(Path.Any)('/b/'))

    expect(literalResult).toBe(decodedResult)
    // @ts-expect-error RED-PIN: order literals are rejected by the current signature
    expectTypeOf(Path.order('/a/', '/b/')).toEqualTypeOf<-1 | 0 | 1>()
  })

  it('is reflexive, antisymmetric, transitive, and agrees with Equal', () => {
    FastCheck.assert(
      FastCheck.property(arb.Any, arb.Any, arb.Any, (a, b, c) => {
        const ab = Path.order(a, b)
        const ba = Path.order(b, a)
        const bc = Path.order(b, c)
        const ac = Path.order(a, c)

        expect(Path.order(a, a)).toBe(0)
        expect(sign(ab)).toBe(sign(-ba))
        expect(ab > 0 || bc > 0 || ac <= 0).toBe(true)
        expect(ab === 0).toBe(Equal.equals(a, b))
      }),
    )
  })
})

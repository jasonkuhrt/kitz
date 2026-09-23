import { assertProperty, describe, expect, expectTypeOf, it } from '@kitz/vitest'
import { Equal, Schema as S } from 'effect'
import * as Arbitrary from 'effect/unstable/arbitrary/Arbitrary'
import * as Path from '../__.js'

const arb = {
  Any: Arbitrary.schema(Path.Any),
} as const
const sign = (value: number): -1 | 0 | 1 => (value < 0 ? -1 : value > 0 ? 1 : 0)

describe('order', () => {
  it('accepts path literals and obeys the decode desugar law', () => {
    const literalResult = Path.order('/a/', '/b/')
    const decodedResult = Path.order(S.decodeSync(Path.Any)('/a/'), S.decodeSync(Path.Any)('/b/'))
    const a = S.decodeSync(Path.Any)('/a/')
    const b = S.decodeSync(Path.Any)('/b/')

    expect(literalResult).toBe(decodedResult)
    expectTypeOf(Path.order('/a/', '/b/')).toEqualTypeOf<-1 | 0 | 1>()
    expect(Path.order('/a/', b)).toBe(Path.order(a, b))
    expect(Path.order(a, '/b/')).toBe(Path.order(a, b))
    expect([b, a].toSorted(Path.order)).toEqual([a, b])

    const dynamic = '/a/' as string
    const staticRejections = () => {
      // @ts-expect-error dynamic strings must be decoded through Path.Any
      Path.order(dynamic, b)
      // @ts-expect-error dynamic strings must be decoded through Path.Any
      Path.order(a, dynamic)
    }
    expect(typeof staticRejections).toBe('function')
  })

  it('is reflexive, antisymmetric, transitive, and agrees with Equal', () => {
    assertProperty([arb.Any, arb.Any, arb.Any], ([a, b, c]) => {
      const ab = Path.order(a, b)
      const ba = Path.order(b, a)
      const bc = Path.order(b, c)
      const ac = Path.order(a, c)

      expect(Path.order(a, a)).toBe(0)
      expect(sign(ab)).toBe(sign(-ba))
      expect(ab > 0 || bc > 0 || ac <= 0).toBe(true)
      expect(ab === 0).toBe(Equal.equals(a, b))
    })
  })
})

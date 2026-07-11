/**
 * Types namespace test suite — organized by FEATURE (see path/_.test.ts).
 *
 * The namespace is almost entirely type-level, so most assertions are
 * build-time (`expectTypeOf`, `@ts-expect-error`); the ZeroWidthSpace
 * const carries the one runtime contract.
 */
import { describe, expect, expectTypeOf, it } from '@kitz/vitest'
import { String } from '../string/_.js'
import * as Types from './__.js'

describe('effect/Types passthrough', () => {
  it('re-exports effect type utilities unchanged', () => {
    expectTypeOf<Types.Simplify<{ a: 1 } & { b: 2 }>>().toEqualTypeOf<{ a: 1; b: 2 }>()
    expectTypeOf<Types.Equals<1, 1>>().toEqualTypeOf<true>()
    expectTypeOf<Types.Equals<1, 2>>().toEqualTypeOf<false>()
  })

  it('does not absorb domain-owned tuple operators', () => {
    const staticRejection = () => {
      // @ts-expect-error Last is owned by the Tuple namespace
      expectTypeOf<Types.Last<readonly ['a', 'b']>>()
    }
    expect(typeof staticRejection).toBe('function')
  })
})

describe('StaticError', () => {
  it('is the message with the zero-width-space brand appended', () => {
    expectTypeOf<Types.StaticError<'boom'>>().toEqualTypeOf<`boom${String.ZeroWidthSpace}`>()
  })

  it('rejects the unbranded message string', () => {
    // The brand exists so a user string can never satisfy an error-typed
    // parameter, even one that textually equals the message.
    const accept = (_: Types.StaticError<'boom'>) => {}
    // @ts-expect-error unbranded literal is not assignable to the branded error
    accept('boom')
    accept(`boom${String.ZeroWidthSpace}`)
  })

  it('rejects dynamic strings', () => {
    const accept = (_: Types.StaticError<'boom'>) => {}
    const dynamic: string = 'boom'
    // @ts-expect-error string is not assignable to the branded error literal
    accept(dynamic)
  })
})

describe('String.ZeroWidthSpace', () => {
  it('is U+200B at runtime and renders as nothing', () => {
    expect(String.ZeroWidthSpace).toBe('\u200B')
    expect(String.ZeroWidthSpace.length).toBe(1)
  })

  it('type twin is the literal of the const', () => {
    expectTypeOf<String.ZeroWidthSpace>().toEqualTypeOf<'\u200B'>()
    // typeof form, not expectTypeOf(value): this expect-type's value-position
    // inference widens literal consts to string.
    expectTypeOf<typeof String.ZeroWidthSpace>().toEqualTypeOf<'\u200B'>()
  })
})

/**
 * Schema namespace test suite — organized by FEATURE (see path/_.test.ts for
 * the principle statement).
 */
import { describe, expect, expectTypeOf, it } from '@kitz/vitest'
import { Effect, Result, Schema as S } from 'effect'
import { Types } from '../types/_.js'
import { Schema } from './_.js'

describe('withStatics', () => {
  class Name extends Schema.withStatics(S.String) {}

  it('attaches and inherits a schema-derived is guard', () => {
    expect(Name.is('Ada')).toBe(true)
    expect(Name.is(42)).toBe(false)

    const input: unknown = 'Grace'
    if (Name.is(input)) expectTypeOf(input).toEqualTypeOf<typeof Name.Type>()
  })

  it('attaches the symmetric Sync, Effect, and Result codec family', () => {
    const names = ['Ada', 'Grace']

    expect(names.map(Name.decodeSync)).toEqual(names)
    expect(names.map(Name.encodeSync)).toEqual(names)
    expect(Effect.runSync(Name.decodeEffect('Ada'))).toBe('Ada')
    expect(Effect.runSync(Name.encodeEffect('Ada'))).toBe('Ada')
    expect(Result.getOrThrow(Name.decodeResult('Ada'))).toBe('Ada')
    expect(Result.getOrThrow(Name.encodeResult('Ada'))).toBe('Ada')
  })

  it('owns its Guard type instead of leaking a bare Schema.Guard', () => {
    expectTypeOf<Schema.withStatics.Guard<typeof S.String>['is']>().toEqualTypeOf<
      (u: unknown) => u is string
    >()

    const staticRejection = () => {
      // @ts-expect-error Guard is owned by Schema.withStatics
      expectTypeOf<Schema.Guard<typeof S.String>>()
    }
    expect(typeof staticRejection).toBe('function')
  })
})

describe('NaturalInt', () => {
  it('carries its non-negative invariant in the Type', () => {
    type $NaturalInt = Schema.NaturalInt
    type $RejectsNegative = -1 extends $NaturalInt ? false : true

    expectTypeOf<$RejectsNegative>().toEqualTypeOf<true>()
    expectTypeOf<Types.Equals<$NaturalInt, number>>().toEqualTypeOf<false>()
    expectTypeOf<$NaturalInt>().toEqualTypeOf<typeof Schema.NaturalInt.Type>()
    expectTypeOf(Schema.NaturalInt.make(0)).toEqualTypeOf<$NaturalInt>()

    const typeChecks = () => {
      // @ts-expect-error negative numbers are not NaturalInt values
      const invalid: $NaturalInt = -1
      return invalid
    }
    expectTypeOf(typeChecks).toBeFunction()
  })
})

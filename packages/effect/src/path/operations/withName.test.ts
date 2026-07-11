import { describe, expect, expectTypeOf, it } from '@kitz/vitest'
import { Option, pipe, Schema as S } from 'effect'
import { NaturalInt } from '../../schema/NaturalInt.js'
import * as Path from '../__.js'

const natural = (value: number) => NaturalInt.make(value)
const someAbsDir = S.decodeSync(Path.AbsDir)('/home/')
const someRelDir = S.decodeSync(Path.RelDir)('./src/')

describe('withName', () => {
  it('path literal duality obeys the desugar law in both call shapes', () => {
    const absDir = Path.make('/workspace/src/')
    const absName = Path.segment('lib')
    const absExpected = Path.withName(absDir, absName)

    expect(absExpected).toEqual(Option.some(Path.make('/workspace/lib/')))
    expect(Path.withName('/workspace/src/', absName)).toEqual(absExpected)
    expect(Path.withName(absName)('/workspace/src/')).toEqual(absExpected)

    const relDir = Path.make('../workspace/src/')
    const relName = Path.segment('test')
    const relExpected = Path.withName(relDir, relName)

    expect(Path.withName('../workspace/src/', relName)).toEqual(relExpected)
    expect(Path.withName(relName)('../workspace/src/')).toEqual(relExpected)
  })

  it('renames the final directory segment', () => {
    expect(Path.withName(someAbsDir, Path.segment('var'))).toEqual(
      Option.some(Path.AbsDir.make({ segments: ['var'].map(Path.segment) })),
    )
    expect(pipe(someRelDir, Path.withName(Path.segment('lib')))).toEqual(
      Option.some(Path.RelDir.make({ ascent: natural(0), segments: ['lib'].map(Path.segment) })),
    )
  })

  it('returns None for root and segment-less relative dirs', () => {
    expect(Path.withName(Path.AbsDir.make({ segments: [] }), Path.segment('root'))).toEqual(
      Option.none(),
    )
    expect(
      Path.withName(Path.RelDir.make({ ascent: natural(2), segments: [] }), Path.segment('src')),
    ).toEqual(Option.none())
  })

  it('types: path and name positions accept decoded values or validated literals', () => {
    const name = Path.segment('next')

    expectTypeOf(Path.withName('/a/', name)).toEqualTypeOf<Option.Option<Path.AbsDir>>()
    expectTypeOf(Path.withName('./a/', name)).toEqualTypeOf<Option.Option<Path.RelDir>>()
    expectTypeOf(Path.withName(someAbsDir, name)).toEqualTypeOf<Option.Option<Path.AbsDir>>()
    expectTypeOf(Path.withName(someRelDir, name)).toEqualTypeOf<Option.Option<Path.RelDir>>()

    expectTypeOf(Path.withName(name)('/a/')).toEqualTypeOf<Option.Option<Path.AbsDir>>()
    expectTypeOf(Path.withName(name)('./a/')).toEqualTypeOf<Option.Option<Path.RelDir>>()
    expectTypeOf(Path.withName(name)(someAbsDir)).toEqualTypeOf<Option.Option<Path.AbsDir>>()
    expectTypeOf(Path.withName(name)(someRelDir)).toEqualTypeOf<Option.Option<Path.RelDir>>()
    expectTypeOf(Path.withName(someAbsDir, 'next')).toEqualTypeOf<Option.Option<Path.AbsDir>>()
    expectTypeOf(Path.withName('next')(someRelDir)).toEqualTypeOf<Option.Option<Path.RelDir>>()

    const dynamic = '/a/' as string
    const openName = 'next' as `name-${string}`

    // Type-only: never executed, so the @ts-expect-error rejections cannot throw.
    const staticRejections = () => {
      // @ts-expect-error dynamic strings are rejected at the data-first path position
      Path.withName(dynamic, name)
      // @ts-expect-error dynamic strings are rejected at the data-last path position
      Path.withName(name)(dynamic)
      // @ts-expect-error segment literals cannot be traversal references
      Path.withName(someAbsDir, '..')
      // @ts-expect-error segment literals cannot contain separators
      Path.withName('bad/name')(someAbsDir)
      // @ts-expect-error open segment templates are not singleton literals
      Path.withName(someAbsDir, openName)
    }
    expect(typeof staticRejections).toBe('function')
  })
})

describe('finding 8: segment name positions accept validated string literals', () => {
  it('withName accepts a valid segment literal', () => {
    const dir = Path.make('/home/user/')
    const renamed = Path.withName(dir, 'renamed')
    expect(Option.map(renamed, (d) => String(d))).toEqual(Option.some('/home/renamed/'))
  })
})

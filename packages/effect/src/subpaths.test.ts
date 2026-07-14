import { describe, expect, expectTypeOf, it } from '@kitz/vitest'
import * as FileSystem from '@kitz/effect/FileSystem'
import * as Path from '@kitz/effect/Path'
import * as Schema from '@kitz/effect/Schema'
import * as String from '@kitz/effect/String'
import * as Tuple from '@kitz/effect/Tuple'
import * as Types from '@kitz/effect/Types'

describe('package subpaths', () => {
  it('exposes FileSystem directly', () => {
    expectTypeOf(FileSystem.layerMemory).toBeFunction()
    expect(FileSystem.Service).toBeDefined()
  })

  it('exposes Path directly', () => {
    expect(Path.make('/tmp/')).toEncodeTo('/tmp/')
  })

  it('exposes Schema directly', () => {
    expect(Schema.decodeSync(Schema.NaturalInt)(0)).toBe(0)
  })

  it('exposes String directly', () => {
    expect(String.camelCase('hello-world')).toBe('helloWorld')
  })

  it('exposes Tuple directly', () => {
    expect(Tuple.make(1, 2)).toEqual([1, 2])
    expectTypeOf<Tuple.Last<readonly [1, 2]>>().toEqualTypeOf<2>()
  })

  it('exposes Types directly', () => {
    expectTypeOf<Types.IsLiteral<'literal'>>().toEqualTypeOf<true>()
  })
})

import { describe, expect, expectTypeOf, it } from '@kitz/vitest'
import { Option } from 'effect'
import * as Path from '../__.js'

describe('name', () => {
  it('returns file names and optional directory names', () => {
    expect(Path.name(Path.AbsFile.make('/a/b.txt'))).toBe('b.txt')
    expect(Path.name(Path.RelFile.make('../a/b.txt'))).toBe('b.txt')
    expect(Path.name(Path.AbsDir.make('/a/b/'))).toEqual(Option.some('b'))
    expect(Path.name(Path.RelDir.make('../a/b/'))).toEqual(Option.some('b'))
    expect(Path.name(Path.AbsDir.anchor)).toEqual(Option.none())
    expect(Path.name(Path.RelDir.parent)).toEqual(Option.none())
  })

  it('distributes its return over files, dirs, and Any', () => {
    expectTypeOf(Path.name(Path.AbsFile.make('/a.txt'))).toEqualTypeOf<string>()
    expectTypeOf(Path.name(Path.RelFile.make('./a.txt'))).toEqualTypeOf<string>()
    expectTypeOf(Path.name(Path.AbsDir.make('/a/'))).toEqualTypeOf<Option.Option<string>>()
    expectTypeOf(Path.name(Path.RelDir.make('./a/'))).toEqualTypeOf<Option.Option<string>>()
    expectTypeOf<Path.NameOf<Path.Any>>().toEqualTypeOf<string | Option.Option<string>>()

    const widened = (path: Path.Any) => {
      expectTypeOf(Path.name(path)).toEqualTypeOf<string | Option.Option<string>>()
    }
    expect(typeof widened).toBe('function')
  })
})

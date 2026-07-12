import { describe, expect, expectTypeOf, it } from '@kitz/vitest'
import { Option } from 'effect'
import * as Path from '../__.js'

describe('extension', () => {
  it('returns file extensions and always returns None for dirs', () => {
    expect(Path.extension(Path.AbsFile.make('/a/b.txt'))).toEqual(Option.some('.txt'))
    expect(Path.extension(Path.RelFile.make('../a/README'))).toEqual(Option.none())
    expect(Path.extension(Path.AbsDir.make('/a/b/'))).toEqual(Option.none())
    expect(Path.extension(Path.RelDir.make('../a/b/'))).toEqual(Option.none())
  })

  it('distributes its return over files, dirs, and Any', () => {
    expectTypeOf(Path.extension(Path.AbsFile.make('/a.txt'))).toEqualTypeOf<
      Option.Option<Path.Extension>
    >()
    expectTypeOf(Path.extension(Path.RelFile.make('./a.txt'))).toEqualTypeOf<
      Option.Option<Path.Extension>
    >()
    expectTypeOf(Path.extension(Path.AbsDir.make('/a/'))).toEqualTypeOf<Option.Option<never>>()
    expectTypeOf(Path.extension(Path.RelDir.make('./a/'))).toEqualTypeOf<Option.Option<never>>()
    expectTypeOf<Path.ExtensionOf<Path.Any>>().toEqualTypeOf<
      Option.Option<Path.Extension> | Option.Option<never>
    >()

    const widened = (path: Path.Any) => {
      expectTypeOf(Path.extension(path)).toEqualTypeOf<
        Option.Option<Path.Extension> | Option.Option<never>
      >()
    }
    expect(typeof widened).toBe('function')
  })
})

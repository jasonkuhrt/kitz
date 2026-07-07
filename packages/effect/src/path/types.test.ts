import { Option } from 'effect'
import { describe, expectTypeOf, it } from '@kitz/vitest'
import * as Path from './__.js'

describe('Path type inference', () => {
  it('data-first and data-last overloads infer the same join variants', () => {
    const absDir = Path.AbsDir.make({ segments: [] })
    const relDir = Path.RelDir.make({ ascent: 0, segments: ['src'] })
    const relFile = Path.RelFile.make({
      ascent: 0,
      segments: ['src'],
      fileName: Path.FileName.make({ stem: 'index', extension: Option.some('.ts') }),
    })

    expectTypeOf(Path.join(absDir, relDir)).toEqualTypeOf<Path.AbsDir>()
    expectTypeOf(Path.join(relDir)(absDir)).toEqualTypeOf<Path.AbsDir>()
    expectTypeOf(Path.join(absDir, relFile)).toEqualTypeOf<Path.AbsFile>()
    expectTypeOf(Path.join(relFile)(absDir)).toEqualTypeOf<Path.AbsFile>()
  })

  it('data-first and data-last overloads infer the same relativeTo and ensureAbs variants', () => {
    const base = Path.AbsDir.make({ segments: ['home'] })
    const file = Path.AbsFile.make({
      segments: ['home', 'src'],
      fileName: Path.FileName.make({ stem: 'index', extension: Option.some('.ts') }),
    })
    const relDir = Path.RelDir.make({ ascent: 0, segments: ['src'] })

    expectTypeOf(Path.relativeTo(file, base)).toEqualTypeOf<Path.RelFile>()
    expectTypeOf(Path.relativeTo(base)(file)).toEqualTypeOf<Path.RelFile>()
    expectTypeOf(Path.ensureAbs(relDir, base)).toEqualTypeOf<Path.AbsDir>()
    expectTypeOf(Path.ensureAbs(base)(relDir)).toEqualTypeOf<Path.AbsDir>()
  })
})

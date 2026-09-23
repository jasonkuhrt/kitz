import { assertProperty, describe, expect, expectTypeOf, it } from '@kitz/vitest'
import { Option, Schema as S } from 'effect'
import * as Arbitrary from 'effect/unstable/arbitrary/Arbitrary'
import { NaturalInt } from '../../schema/NaturalInt.js'
import { Types } from '../../types/_.js'
import * as Path from '../__.js'
import { maxAscent } from '../models/ascent.js'

// Uniform choice between two non-Schema arbitraries, selected by a generated
// boolean (Schema-described alternatives use a Schema union instead).
const oneOf = <$A, $B>(
  first: Arbitrary.Arbitrary<$A>,
  second: Arbitrary.Arbitrary<$B>,
): Arbitrary.Arbitrary<$A | $B> =>
  Arbitrary.flatMap(Arbitrary.schema(S.Boolean), (pickFirst): Arbitrary.Arbitrary<$A | $B> =>
    pickFirst ? first : second,
  )

const natural = (value: number) => NaturalInt.make(value)
const arbSegment = Arbitrary.schema(Path.Segment)
const arbFileName = Arbitrary.schema(Path.FileName)
const arbAbsDir = Arbitrary.schema(Path.AbsDir)
const arbRelDir = Arbitrary.schema(Path.RelDir)
const arb = {
  AbsDir: arbAbsDir,
  RelDir: arbRelDir,
} as const
// Static choice is a Schema union: the native runner picks alternatives uniformly.
const abs = Arbitrary.schema(S.Union([Path.AbsDir, Path.AbsFile]))
const rel = Arbitrary.schema(S.Union([Path.RelDir, Path.RelFile]))
const dir = Arbitrary.schema(S.Union([Path.AbsDir, Path.RelDir]))
const relDirAscent0 = Arbitrary.map(Arbitrary.array(arbSegment, { maxLength: 6 }), (segments) =>
  Path.RelDir.make({ ascent: natural(0), segments }),
)
const relFileAscent0 = Arbitrary.map(
  Arbitrary.all({
    segments: Arbitrary.array(arbSegment, { maxLength: 6 }),
    fileName: arbFileName,
  }),
  (input) =>
    Path.RelFile.make({
      dir: Path.RelDir.make({ ascent: natural(0), segments: input.segments }),
      fileName: input.fileName,
    }),
)
const relAscent0 = oneOf(relDirAscent0, relFileAscent0)

const someAbsFile = S.decodeSync(Path.AbsFile)('/home/src/index.ts')
const someAbsDir = S.decodeSync(Path.AbsDir)('/home/')
const someRelFile = S.decodeSync(Path.RelFile)('./src/index.ts')
const someRelDir = S.decodeSync(Path.RelDir)('./src/')

describe('relativeTo', () => {
  it('types: widened path unions require group narrowing first', () => {
    type $Expected =
      Types.StaticError<'Path.relativeTo requires a path narrowed to one group. Narrow with Path.Abs.is or Path.Rel.is first.'>
    type $WideBase = Parameters<typeof Path.relativeTo<Path.Any, Path.Dir>>[1]

    expectTypeOf<$WideBase>().toEqualTypeOf<$Expected>()
  })

  it('offers monomorphic Abs and Rel producer statics', () => {
    const absDirect = Path.Abs.relativeTo('/workspace/src/index.ts', '/workspace/')
    const absCurried = Path.Abs.relativeTo('/workspace/')('/workspace/src/index.ts')
    const relDirect = Path.Rel.relativeTo('../workspace/src/', '../workspace/')
    const relCurried = Path.Rel.relativeTo('../workspace/')('../workspace/src/')

    expectTypeOf(absDirect).toEqualTypeOf<Path.Rel>()
    expectTypeOf(absCurried).toEqualTypeOf<Path.Rel>()
    expectTypeOf(relDirect).toEqualTypeOf<Option.Option<Path.Rel>>()
    expectTypeOf(relCurried).toEqualTypeOf<Option.Option<Path.Rel>>()
    expect(absDirect).toEncodeTo('./src/index.ts')
    expect(absCurried).toEqual(absDirect)
    expect(relDirect).toEqual(Option.some(Path.RelDir.make('./src/')))
    expect(relCurried).toEqual(relDirect)
  })

  it('producer statics agree with the unified operation', () => {
    assertProperty([abs, arbAbsDir], ([target, base]) => {
      const expected = Path.relativeTo(target, base)
      expect(Path.Abs.relativeTo(target, base)).toEqual(expected)
      expect(Path.Abs.relativeTo(base)(target)).toEqual(expected)
    })
    assertProperty([rel, arbRelDir], ([target, base]) => {
      const expected = Path.relativeTo(target, base)
      expect(Path.Rel.relativeTo(target, base)).toEqual(expected)
      expect(Path.Rel.relativeTo(base)(target)).toEqual(expected)
    })
  })

  it('literal duality obeys the desugar law in both call shapes', () => {
    const absPath = Path.make('/workspace/src/index.ts')
    const absBase = Path.make('/workspace/')
    const absExpected = Path.relativeTo(absPath, absBase)

    expect(absExpected).toEncodeTo('./src/index.ts')
    expect(Path.relativeTo('/workspace/src/index.ts', absBase)).toEqual(absExpected)
    expect(Path.relativeTo(absPath, '/workspace/')).toEqual(absExpected)
    expect(Path.relativeTo('/workspace/src/index.ts', '/workspace/')).toEqual(absExpected)
    expect(Path.relativeTo('/workspace/')(absPath)).toEqual(absExpected)
    expect(Path.relativeTo(absBase)('/workspace/src/index.ts')).toEqual(absExpected)

    const relPath = Path.make('../workspace/src/')
    const relBase = Path.make('../workspace/')
    const relExpected = Path.relativeTo(relPath, relBase)

    expect(Path.relativeTo('../workspace/src/', relBase)).toEqual(relExpected)
    expect(Path.relativeTo(relPath, '../workspace/')).toEqual(relExpected)
    expect(Path.relativeTo('../workspace/src/', '../workspace/')).toEqual(relExpected)
    expect(Path.relativeTo('../workspace/')(relPath)).toEqual(relExpected)
    expect(Path.relativeTo(relBase)('../workspace/src/')).toEqual(relExpected)
  })

  it('join(base, relativeTo(abs, base)) returns the original absolute path', () => {
    assertProperty([abs, arb.AbsDir], ([path, base]) => {
      expect(Path.join(base, Path.relativeTo(path, base))).toEqual(path)
    })
  })

  it('relative relativeTo is Some exactly when target ascent is not shallower than base ascent and the walk up fits the ascent ceiling', () => {
    assertProperty([rel, arb.RelDir], ([target, base]) => {
      const relative = Path.relativeTo(target, base)
      // Walk up out of every base segment not shared with the target, then up
      // the ascent difference; a result needs that many leading `..` steps.
      const shared = Path.Rel.commonAncestor(target, base).segments.length
      const walkUp = base.segments.length - shared + (target.ascent - base.ascent)
      const isExpressible = target.ascent >= base.ascent && walkUp <= maxAscent

      expect(Option.isSome(relative)).toBe(isExpressible)
      expect(Option.map(relative, (value) => Path.join(base, value))).toEqual(
        isExpressible ? Option.some(target) : Option.none(),
      )
    })
  })

  it('relativeTo(join(base, r), base) returns ascent-0 relative paths', () => {
    assertProperty([dir, relAscent0], ([base, r]) => {
      const joined = Path.join(base, r)
      const relative = Path.relativeTo(joined as never, base as never)
      const relativeOption = Option.isOption(relative) ? relative : Option.some(relative)

      expect(relativeOption).toEqual(Option.some(r))
    })
  })

  it('types: literal/value matrices preserve the precise relative return', () => {
    expectTypeOf(Path.relativeTo('/a/file.ts', '/a/')).toEqualTypeOf<Path.RelFile>()
    expectTypeOf(Path.relativeTo('/a/', someAbsDir)).toEqualTypeOf<Path.RelDir>()
    expectTypeOf(Path.relativeTo(someAbsFile, '/a/')).toEqualTypeOf<Path.RelFile>()
    expectTypeOf(Path.relativeTo(someAbsFile, someAbsDir)).toEqualTypeOf<Path.RelFile>()

    expectTypeOf(Path.relativeTo('./a/file.ts', './a/')).toEqualTypeOf<
      Option.Option<Path.RelFile>
    >()
    expectTypeOf(Path.relativeTo('./a/', someRelDir)).toEqualTypeOf<Option.Option<Path.RelDir>>()
    expectTypeOf(Path.relativeTo(someRelFile, './a/')).toEqualTypeOf<Option.Option<Path.RelFile>>()

    expectTypeOf(Path.relativeTo('/a/')('/a/file.ts')).toEqualTypeOf<Path.RelFile>()
    expectTypeOf(Path.relativeTo(someAbsDir)(someAbsFile)).toEqualTypeOf<Path.RelFile>()
    expectTypeOf(Path.relativeTo('./a/')('./a/file.ts')).toEqualTypeOf<
      Option.Option<Path.RelFile>
    >()
    expectTypeOf(Path.relativeTo(someRelDir)('./a/')).toEqualTypeOf<Option.Option<Path.RelDir>>()

    // the exported type utility agrees cell-by-cell
    expectTypeOf<Path.RelativeTo<Path.AbsDir>>().toEqualTypeOf<Path.RelDir>()
    expectTypeOf<Path.RelativeTo<Path.AbsFile>>().toEqualTypeOf<Path.RelFile>()
    expectTypeOf<Path.RelativeTo<Path.RelDir>>().toEqualTypeOf<Path.RelDir>()
    expectTypeOf<Path.RelativeTo<Path.RelFile>>().toEqualTypeOf<Path.RelFile>()

    const dynamic = '/a/' as string

    // Type-only: never executed, so the @ts-expect-error rejections cannot throw.
    const staticRejections = () => {
      // @ts-expect-error dynamic strings are rejected at the data-first path position
      Path.relativeTo(dynamic, someAbsDir)
      // @ts-expect-error dynamic strings are rejected at the data-first base position
      Path.relativeTo(someAbsFile, dynamic)
      // @ts-expect-error dynamic strings are rejected at the data-last base position
      Path.relativeTo(dynamic)
      // @ts-expect-error dynamic strings are rejected at the data-last path position
      Path.relativeTo(someAbsDir)(dynamic)
      // @ts-expect-error path and base literals must belong to the same group
      Path.relativeTo('/a/file.ts', './a/')
      // @ts-expect-error the curried path literal must match the base literal's group
      Path.relativeTo('./a/')('/a/file.ts')
      // @ts-expect-error path and base values must belong to the same group
      Path.relativeTo(someAbsFile, someRelDir)
      // @ts-expect-error the curried path value must match the base value's group
      Path.relativeTo(someRelDir)(someAbsFile)
    }
    const widenedRejections = (wideAny: Path.Any, wideFile: Path.File, wideDir: Path.Dir) => {
      // @ts-expect-error a widened Any target must be narrowed to Abs or Rel first
      Path.relativeTo(wideAny, wideDir)
      // @ts-expect-error a widened File target must be narrowed to Abs or Rel first
      Path.relativeTo(wideFile, wideDir)
      // @ts-expect-error a widened Dir target must be narrowed to Abs or Rel first
      Path.relativeTo(wideDir, wideDir)
      // @ts-expect-error a widened base must be narrowed before the curried call
      Path.relativeTo(wideDir)
      // @ts-expect-error a widened callback target must be narrowed to Abs or Rel first
      Path.relativeTo(someAbsDir)(wideAny)
    }
    expect(typeof staticRejections).toBe('function')
    expect(typeof widenedRejections).toBe('function')
  })
})

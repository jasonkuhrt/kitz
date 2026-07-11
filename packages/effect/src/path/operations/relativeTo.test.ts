import { describe, expect, expectTypeOf, it } from '@kitz/vitest'
import { Option, Schema as S } from 'effect'
import { FastCheck } from 'effect/testing'
import { Types } from '../../types/_.js'
import * as Path from '../__.js'

const arbSegment = S.toArbitrary(Path.Segment)
const arbFileName = S.toArbitrary(Path.FileName)
const arbAbsDir = S.toArbitrary(Path.AbsDir)
const arbAbsFile = S.toArbitrary(Path.AbsFile)
const arbRelDir = S.toArbitrary(Path.RelDir)
const arbRelFile = S.toArbitrary(Path.RelFile)
const arb = {
  AbsDir: arbAbsDir,
  RelDir: arbRelDir,
} as const
const abs = FastCheck.oneof(arbAbsDir, arbAbsFile)
const rel = FastCheck.oneof(arbRelDir, arbRelFile)
const dir = FastCheck.oneof(arbAbsDir, arbRelDir)
const relDirAscent0 = FastCheck.array(arbSegment, { maxLength: 6 }).map((segments) =>
  Path.RelDir.make({ ascent: 0, segments }),
)
const relFileAscent0 = FastCheck.record({
  segments: FastCheck.array(arbSegment, { maxLength: 6 }),
  fileName: arbFileName,
}).map((input) =>
  Path.RelFile.make({
    dir: Path.RelDir.make({ ascent: 0, segments: input.segments }),
    fileName: input.fileName,
  }),
)
const relAscent0 = FastCheck.oneof(relDirAscent0, relFileAscent0)

const someAbsFile = S.decodeSync(Path.AbsFile)('/home/src/index.ts')
const someAbsDir = S.decodeSync(Path.AbsDir)('/home/')
const someRelFile = S.decodeSync(Path.RelFile)('./src/index.ts')
const someRelDir = S.decodeSync(Path.RelDir)('./src/')

describe('relativeTo', () => {
  it('types: widened path unions require group narrowing first', () => {
    type $Expected =
      Types.StaticError<'Path.relativeTo requires a path narrowed to one group. Narrow with Path.Abs.is or Path.Rel.is first.'>
    type $WideBase = Parameters<typeof Path.relativeTo<Path.Any, Path.Dir>>[1]

    // @ts-expect-error RED-PIN: a widened Any path currently accepts the full Dir union
    expectTypeOf<$WideBase>().toEqualTypeOf<$Expected>()
  })

  it('offers monomorphic Abs and Rel producer statics', () => {
    // @ts-expect-error RED-PIN: Abs.relativeTo is not attached yet
    const abs = Path.Abs.relativeTo('/workspace/src/index.ts', '/workspace/')
    // @ts-expect-error RED-PIN: Rel.relativeTo is not attached yet
    const rel = Path.Rel.relativeTo('../workspace/src/', '../workspace/')

    expect(abs).toEncodeTo('./src/index.ts')
    expect(rel).toEqual(Option.some(Path.RelDir.mk('./src/')))
  })

  it('literal duality obeys the desugar law in both call shapes', () => {
    const absPath = Path.mk('/workspace/src/index.ts')
    const absBase = Path.mk('/workspace/')
    const absExpected = Path.relativeTo(absPath, absBase)

    expect(absExpected).toEncodeTo('./src/index.ts')
    expect(Path.relativeTo('/workspace/src/index.ts', absBase)).toEqual(absExpected)
    expect(Path.relativeTo(absPath, '/workspace/')).toEqual(absExpected)
    expect(Path.relativeTo('/workspace/src/index.ts', '/workspace/')).toEqual(absExpected)
    expect(Path.relativeTo('/workspace/')(absPath)).toEqual(absExpected)
    expect(Path.relativeTo(absBase)('/workspace/src/index.ts')).toEqual(absExpected)

    const relPath = Path.mk('../workspace/src/')
    const relBase = Path.mk('../workspace/')
    const relExpected = Path.relativeTo(relPath, relBase)

    expect(Path.relativeTo('../workspace/src/', relBase)).toEqual(relExpected)
    expect(Path.relativeTo(relPath, '../workspace/')).toEqual(relExpected)
    expect(Path.relativeTo('../workspace/src/', '../workspace/')).toEqual(relExpected)
    expect(Path.relativeTo('../workspace/')(relPath)).toEqual(relExpected)
    expect(Path.relativeTo(relBase)('../workspace/src/')).toEqual(relExpected)
  })

  it('join(base, relativeTo(abs, base)) returns the original absolute path', () => {
    FastCheck.assert(
      FastCheck.property(abs, arb.AbsDir, (path, base) => {
        expect(Path.join(base, Path.relativeTo(path, base))).toEqual(path)
      }),
    )
  })

  it('relative relativeTo is Some exactly when target ascent is not shallower than base ascent', () => {
    FastCheck.assert(
      FastCheck.property(rel, arb.RelDir, (target, base) => {
        const relative = Path.relativeTo(target, base)
        const isExpressible = target.ascent >= base.ascent

        expect(Option.isSome(relative)).toBe(isExpressible)
        expect(Option.map(relative, (value) => Path.join(base, value))).toEqual(
          isExpressible ? Option.some(target) : Option.none(),
        )
      }),
    )
  })

  it('relativeTo(join(base, r), base) returns ascent-0 relative paths', () => {
    FastCheck.assert(
      FastCheck.property(dir, relAscent0, (base, r) => {
        const joined = Path.join(base, r)
        const relative = Path.relativeTo(joined as never, base as never)
        const relativeOption = Option.isOption(relative) ? relative : Option.some(relative)

        expect(relativeOption).toEqual(Option.some(r))
      }),
    )
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
    expect(typeof staticRejections).toBe('function')
  })
})

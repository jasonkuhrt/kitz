import { describe, expect, expectTypeOf, it } from '@kitz/vitest'
import { Equal, Schema as S } from 'effect'
import { FastCheck } from 'effect/testing'
import * as Path from '../__.js'

const arbSegment = S.toArbitrary(Path.Segment)
const arbFileName = S.toArbitrary(Path.FileName)
const arbAbsDir = S.toArbitrary(Path.AbsDir)
const arbRelDir = S.toArbitrary(Path.RelDir)
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

const someAbsDir = S.decodeSync(Path.AbsDir)('/home/')
const someRelFile = S.decodeSync(Path.RelFile)('./src/index.ts')
const someRelDir = S.decodeSync(Path.RelDir)('./src/')

describe('join', () => {
  it('literal duality obeys the desugar law across mixed variadic positions', () => {
    const base = Path.mk('/workspace/')
    const first = Path.mk('./src/')
    const second = Path.mk('./generated/')
    const last = Path.mk('./index.ts')
    const expected = Path.join(base, first, second, last)

    expect(expected).toEncodeTo('/workspace/src/generated/index.ts')
    expect(Path.join('/workspace/', './src/', './generated/', './index.ts')).toEqual(expected)
    expect(Path.join('/workspace/', first, './generated/', last)).toEqual(expected)
    expect(Path.join(base, './src/', second, './index.ts')).toEqual(expected)
    expect(Path.join('/workspace/', './src/', second, last)).toEqual(expected)

    expect(Path.join('./index.ts')('/workspace/')).toEqual(Path.join(last)(base))
    expect(Path.join('./index.ts')(base)).toEqual(Path.join(last)(base))
    expect(Path.join(last)('/workspace/')).toEqual(Path.join(last)(base))
  })

  it('variadic join is a left fold of binary join', () => {
    FastCheck.assert(
      FastCheck.property(
        dir,
        relDirAscent0,
        relDirAscent0,
        relAscent0,
        (base, first, second, last) => {
          expect(Path.join(base, first, second, last)).toEqual(
            Path.join(Path.join(Path.join(base, first), second), last),
          )
        },
      ),
    )
  })

  it('types: mixed variadic literals preserve the precise left-fold return', () => {
    expectTypeOf(Path.join('/base/', './dir/')).toEqualTypeOf<Path.AbsDir>()
    expectTypeOf(Path.join('/base/', './file.ts')).toEqualTypeOf<Path.AbsFile>()
    expectTypeOf(Path.join('./base/', './dir/')).toEqualTypeOf<Path.RelDir>()
    expectTypeOf(Path.join('./base/', './file.ts')).toEqualTypeOf<Path.RelFile>()

    expectTypeOf(Path.join(someAbsDir, someRelDir)).toEqualTypeOf<Path.AbsDir>()
    expectTypeOf(Path.join(someAbsDir, someRelFile)).toEqualTypeOf<Path.AbsFile>()
    expectTypeOf(Path.join(someRelDir, someRelDir)).toEqualTypeOf<Path.RelDir>()
    expectTypeOf(Path.join(someRelDir, someRelFile)).toEqualTypeOf<Path.RelFile>()

    expectTypeOf(
      Path.join('/base/', './one/', someRelDir, './three/', './file.ts'),
    ).toEqualTypeOf<Path.AbsFile>()
    expectTypeOf(
      Path.join(someRelDir, './one/', someRelDir, './three/'),
    ).toEqualTypeOf<Path.RelDir>()

    expectTypeOf(Path.join('./file.ts')('/base/')).toEqualTypeOf<Path.AbsFile>()
    expectTypeOf(Path.join('./file.ts')('./base/')).toEqualTypeOf<Path.RelFile>()
    expectTypeOf(Path.join('./file.ts')(someAbsDir)).toEqualTypeOf<Path.AbsFile>()
    expectTypeOf(Path.join(someRelFile)('/base/')).toEqualTypeOf<Path.AbsFile>()
    expectTypeOf(Path.join(someRelDir)(someAbsDir)).toEqualTypeOf<Path.AbsDir>()
    expectTypeOf(Path.join(someRelFile)(someAbsDir)).toEqualTypeOf<Path.AbsFile>()

    // the exported type utility agrees cell-by-cell
    expectTypeOf<Path.Join<Path.AbsDir, Path.RelDir>>().toEqualTypeOf<Path.AbsDir>()
    expectTypeOf<Path.Join<Path.AbsDir, Path.RelFile>>().toEqualTypeOf<Path.AbsFile>()
    expectTypeOf<Path.Join<Path.RelDir, Path.RelDir>>().toEqualTypeOf<Path.RelDir>()
    expectTypeOf<Path.Join<Path.RelDir, Path.RelFile>>().toEqualTypeOf<Path.RelFile>()

    const dynamic = './dynamic/' as string

    // Type-only: never executed, so the @ts-expect-error rejections cannot throw.
    const staticRejections = () => {
      // @ts-expect-error dynamic strings are rejected at the data-first base position
      Path.join(dynamic, someRelFile)
      // @ts-expect-error dynamic strings are rejected at intermediate positions
      Path.join(someAbsDir, dynamic, someRelFile)
      // @ts-expect-error dynamic strings are rejected at the final relative position
      Path.join(someAbsDir, someRelDir, dynamic)
      // @ts-expect-error dynamic strings are rejected at the data-last relative position
      Path.join(dynamic)
      // @ts-expect-error dynamic strings are rejected at the curried target position
      Path.join(someRelFile)(dynamic)
      // @ts-expect-error intermediate relative parts cannot be absolute literals
      Path.join(someAbsDir, '//', someRelFile)
      // @ts-expect-error relative parts cannot be absolute literals
      Path.join(someAbsDir, './middle/', '/absolute.ts')
      // @ts-expect-error data-last relative parts cannot be absolute literals
      Path.join('/absolute.ts')
    }
    expect(typeof staticRejections).toBe('function')
  })
})

describe('join identity', () => {
  it('RelDir.anchor is the join identity for dirs', () => {
    FastCheck.assert(
      FastCheck.property(dir, (d) => {
        expect(Equal.equals(Path.join(d, Path.RelDir.anchor), d)).toBe(true)
      }),
    )
  })
})

describe('finding 4: operations accept target-coercible dir literals like model mk', () => {
  it('join accepts a slashless dir base literal, matching Dir.mk', () => {
    const joined = Path.join('/foo', './x')
    expect(String(joined)).toBe('/foo/x')
  })
})

import { describe, expect, expectTypeOf, it } from '@kitz/vitest'
import { Schema as S } from 'effect'
import { FastCheck } from 'effect/testing'
import * as Path from '../__.js'

const arb = {
  Any: S.toArbitrary(Path.Any),
  AbsDir: S.toArbitrary(Path.AbsDir),
} as const

const someAbsFile = S.decodeSync(Path.AbsFile)('/home/src/index.ts')
const someAbsDir = S.decodeSync(Path.AbsDir)('/home/')
const someRelFile = S.decodeSync(Path.RelFile)('./src/index.ts')
const someRelDir = S.decodeSync(Path.RelDir)('./src/')

describe('ensureAbs', () => {
  it('literal duality obeys the desugar law in both call shapes', () => {
    const relFile = Path.make('./src/index.ts')
    const base = Path.make('/workspace/')
    const expected = Path.ensureAbs(relFile, base)

    expect(expected).toEncodeTo('/workspace/src/index.ts')
    expect(Path.ensureAbs('./src/index.ts', base)).toEqual(expected)
    expect(Path.ensureAbs(relFile, '/workspace/')).toEqual(expected)
    expect(Path.ensureAbs('./src/index.ts', '/workspace/')).toEqual(expected)
    expect(Path.ensureAbs('/workspace/')(relFile)).toEqual(expected)
    expect(Path.ensureAbs(base)('./src/index.ts')).toEqual(expected)

    expect(Path.ensureAbs('/already/file.ts', '/elsewhere/')).toEqual(
      Path.ensureAbs(Path.make('/already/file.ts'), Path.make('/elsewhere/')),
    )
  })

  it('literal desugaring agrees with generated path and base values', () => {
    FastCheck.assert(
      FastCheck.property(arb.Any, arb.AbsDir, (path, base) => {
        expect(Path.ensureAbs('./fixed/file.ts', base)).toEqual(
          Path.ensureAbs(Path.make('./fixed/file.ts'), base),
        )
        expect(Path.ensureAbs(path, '/fixed/base/')).toEqual(
          Path.ensureAbs(path, Path.make('/fixed/base/')),
        )
      }),
    )
  })

  it('is idempotent and reference-preserving for absolute inputs', () => {
    FastCheck.assert(
      FastCheck.property(arb.Any, arb.AbsDir, (path, base) => {
        const ensured = Path.ensureAbs(path, base)
        expect(Path.ensureAbs(ensured, base)).toBe(ensured)
        expect(Path.Abs.is(path) ? ensured === path : true).toBe(true)
      }),
    )
  })

  it('types: literal/value matrices preserve the precise EnsureAbs return', () => {
    expectTypeOf(Path.ensureAbs('./src/', '/workspace/')).toEqualTypeOf<Path.AbsDir>()
    expectTypeOf(Path.ensureAbs('./src/file.ts', someAbsDir)).toEqualTypeOf<Path.AbsFile>()
    expectTypeOf(Path.ensureAbs(someRelDir, '/workspace/')).toEqualTypeOf<Path.AbsDir>()
    expectTypeOf(Path.ensureAbs(someRelDir, someAbsDir)).toEqualTypeOf<Path.AbsDir>()

    expectTypeOf(Path.ensureAbs('/workspace/')('./src/file.ts')).toEqualTypeOf<Path.AbsFile>()
    expectTypeOf(Path.ensureAbs('/workspace/')(someRelDir)).toEqualTypeOf<Path.AbsDir>()
    expectTypeOf(Path.ensureAbs(someAbsDir)('./src/file.ts')).toEqualTypeOf<Path.AbsFile>()
    expectTypeOf(Path.ensureAbs(someAbsDir)(someRelDir)).toEqualTypeOf<Path.AbsDir>()

    expectTypeOf(Path.ensureAbs('/already/', someAbsDir)).toEqualTypeOf<Path.AbsDir>()
    expectTypeOf(Path.ensureAbs('/already/file.ts', someAbsDir)).toEqualTypeOf<Path.AbsFile>()
    expectTypeOf(Path.ensureAbs(someRelFile, someAbsDir)).toEqualTypeOf<Path.AbsFile>()
    expectTypeOf(Path.ensureAbs(someAbsFile, someAbsDir)).toEqualTypeOf<Path.AbsFile>()

    // the exported type utility agrees cell-by-cell
    expectTypeOf<Path.EnsureAbs<Path.AbsDir>>().toEqualTypeOf<Path.AbsDir>()
    expectTypeOf<Path.EnsureAbs<Path.AbsFile>>().toEqualTypeOf<Path.AbsFile>()
    expectTypeOf<Path.EnsureAbs<Path.RelDir>>().toEqualTypeOf<Path.AbsDir>()
    expectTypeOf<Path.EnsureAbs<Path.RelFile>>().toEqualTypeOf<Path.AbsFile>()

    const dynamic = './src/file.ts' as string

    // Type-only: never executed, so the @ts-expect-error rejections cannot throw.
    const staticRejections = () => {
      // @ts-expect-error dynamic strings are rejected at the data-first path position
      Path.ensureAbs(dynamic, someAbsDir)
      // @ts-expect-error dynamic strings are rejected at the data-first base position
      Path.ensureAbs(someRelFile, dynamic)
      // @ts-expect-error dynamic strings are rejected at the data-last base position
      Path.ensureAbs(dynamic)
      // @ts-expect-error dynamic strings are rejected at the data-last path position
      Path.ensureAbs(someAbsDir)(dynamic)
      // @ts-expect-error base literals must be absolute
      Path.ensureAbs(someRelFile, './workspace/')
    }
    expect(typeof staticRejections).toBe('function')
  })
})

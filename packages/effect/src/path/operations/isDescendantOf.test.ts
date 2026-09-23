import { assertProperty, describe, expect, expectTypeOf, it } from '@kitz/vitest'
import { Schema as S } from 'effect'
import * as Arbitrary from 'effect/unstable/arbitrary/Arbitrary'
import { NaturalInt } from '../../schema/NaturalInt.js'
import * as Path from '../__.js'

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
// Static choice is a Schema union: the native runner picks alternatives uniformly.
const dir = Arbitrary.schema(S.Union([Path.AbsDir, Path.RelDir]))
const file = Arbitrary.schema(S.Union([Path.AbsFile, Path.RelFile]))
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
const nonEmptyRelAscent0 = oneOf(
  Arbitrary.map(Arbitrary.array(arbSegment, { minLength: 1, maxLength: 6 }), (segments) =>
    Path.RelDir.make({ ascent: natural(0), segments }),
  ),
  relFileAscent0,
)

const someAbsFile = S.decodeSync(Path.AbsFile)('/home/src/index.ts')
const someAbsDir = S.decodeSync(Path.AbsDir)('/home/')
const someRelDir = S.decodeSync(Path.RelDir)('./src/')

describe('isDescendantOf', () => {
  it('literal duality obeys the desugar law in both call shapes', () => {
    const relChild = Path.make('./a/b.txt')
    const relParent = Path.make('./a/')
    const expected = Path.isDescendantOf(relChild, relParent)

    expect(expected).toBe(true)
    expect(Path.isDescendantOf('./a/b.txt', relParent)).toBe(expected)
    expect(Path.isDescendantOf(relChild, './a/')).toBe(expected)
    expect(Path.isDescendantOf('./a/b.txt', './a/')).toBe(expected)
    expect(Path.isDescendantOf('./a/')(relChild)).toBe(expected)
    expect(Path.isDescendantOf(relParent)('./a/b.txt')).toBe(expected)

    expect(Path.isDescendantOf('/a/b.txt', '/a/')).toBe(
      Path.isDescendantOf(Path.make('/a/b.txt'), Path.make('/a/')),
    )
    expect(Path.isDescendantOf('./a/', './a/')).toBe(false)
  })

  it('joining a non-empty ascent-0 relative path makes it a descendant', () => {
    assertProperty([dir, nonEmptyRelAscent0], ([base, r]) => {
      const child = Path.join(base, r)
      expect(child).toBeWithinPath(base)
    })
  })

  it('is strict for directory identity', () => {
    assertProperty([dir], ([path]) => {
      expect(Path.isDescendantOf(path, path)).toBe(false)
    })
  })

  it('keeps files directly inside their containing dir as descendants', () => {
    assertProperty([file], ([path]) => {
      expect(Path.isDescendantOf(path, path.dir)).toBe(true)
    })
  })

  it('keeps different-ascent pure relatives strict', () => {
    expect(
      Path.isDescendantOf(
        Path.RelDir.make({ ascent: natural(1), segments: [] }),
        Path.RelDir.make({ ascent: natural(2), segments: [] }),
      ),
    ).toBe(true)
  })

  it('types: every path position accepts values or literals and rejects invalid worlds', () => {
    expectTypeOf(Path.isDescendantOf('/a/b.txt', '/a/')).toEqualTypeOf<boolean>()
    expectTypeOf(Path.isDescendantOf('/a/b.txt', someAbsDir)).toEqualTypeOf<boolean>()
    expectTypeOf(Path.isDescendantOf(someAbsFile, '/a/')).toEqualTypeOf<boolean>()
    expectTypeOf(Path.isDescendantOf(someAbsFile, someAbsDir)).toEqualTypeOf<boolean>()

    expectTypeOf(Path.isDescendantOf('/a/')('/a/b.txt')).toEqualTypeOf<boolean>()
    expectTypeOf(Path.isDescendantOf('/a/')(someAbsFile)).toEqualTypeOf<boolean>()
    expectTypeOf(Path.isDescendantOf(someAbsDir)('/a/b.txt')).toEqualTypeOf<boolean>()
    expectTypeOf(Path.isDescendantOf(someAbsDir)(someAbsFile)).toEqualTypeOf<boolean>()

    const dynamic = '/a/' as string

    // Type-only: never executed, so the @ts-expect-error rejections cannot throw.
    const staticRejections = () => {
      // @ts-expect-error dynamic strings are rejected at the data-first child position
      Path.isDescendantOf(dynamic, someAbsDir)
      // @ts-expect-error dynamic strings are rejected at the data-first parent position
      Path.isDescendantOf(someAbsFile, dynamic)
      // @ts-expect-error dynamic strings are rejected at the data-last parent position
      Path.isDescendantOf(dynamic)
      // @ts-expect-error dynamic strings are rejected at the data-last child position
      Path.isDescendantOf(someAbsDir)(dynamic)
      // @ts-expect-error child and parent literals must belong to the same group
      Path.isDescendantOf('/a/b.txt', './a/')
      // @ts-expect-error the curried child literal must match the parent literal's group
      Path.isDescendantOf('./a/')('/a/b.txt')
      // @ts-expect-error child and parent values must belong to the same group
      Path.isDescendantOf(someAbsFile, someRelDir)
      // @ts-expect-error the curried child value must match the parent value's group
      Path.isDescendantOf(someRelDir)(someAbsFile)
    }
    expect(typeof staticRejections).toBe('function')
  })
})

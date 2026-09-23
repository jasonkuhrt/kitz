import { assertProperty, describe, expect, expectTypeOf, it } from '@kitz/vitest'
import { Equal, Schema as S } from 'effect'
import * as Arbitrary from 'effect/unstable/arbitrary/Arbitrary'
import { NaturalInt } from '../../schema/NaturalInt.js'
import * as Path from '../__.js'

const natural = (value: number) => NaturalInt.make(value)
const arb = {
  Any: Arbitrary.schema(Path.Any),
  AbsDir: Arbitrary.schema(Path.AbsDir),
} as const
// Static choice is a Schema union: the native runner picks alternatives uniformly.
const abs = Arbitrary.schema(S.Union([Path.AbsDir, Path.AbsFile]))
const rel = Arbitrary.schema(S.Union([Path.RelDir, Path.RelFile]))
const dir = Arbitrary.schema(S.Union([Path.AbsDir, Path.RelDir]))

const someAbsFile = S.decodeSync(Path.AbsFile)('/home/src/index.ts')
const someAbsDir = S.decodeSync(Path.AbsDir)('/home/')
const someRelDir = S.decodeSync(Path.RelDir)('./src/')

describe('isWithin', () => {
  it.each([
    [
      './a within ./',
      Path.RelDir.make({ ascent: natural(0), segments: ['a'].map(Path.segment) }),
      Path.RelDir.anchor,
      true,
    ],
    [
      './a within ../',
      Path.RelDir.make({ ascent: natural(0), segments: ['a'].map(Path.segment) }),
      Path.RelDir.make({ ascent: natural(1), segments: [] }),
      true,
    ],
    [
      '../x within ../../',
      Path.RelDir.make({ ascent: natural(1), segments: ['x'].map(Path.segment) }),
      Path.RelDir.make({ ascent: natural(2), segments: [] }),
      true,
    ],
    [
      '../a within ../b',
      Path.RelDir.make({ ascent: natural(1), segments: ['a'].map(Path.segment) }),
      Path.RelDir.make({ ascent: natural(1), segments: ['b'].map(Path.segment) }),
      false,
    ],
    [
      '../../ within ./',
      Path.RelDir.make({ ascent: natural(2), segments: [] }),
      Path.RelDir.anchor,
      false,
    ],
    [
      '/apps/ within /',
      Path.AbsDir.make({ segments: ['apps'].map(Path.segment) }),
      Path.AbsDir.anchor,
      true,
    ],
    [
      '/apps/ within /libs/',
      Path.AbsDir.make({ segments: ['apps'].map(Path.segment) }),
      Path.AbsDir.make({ segments: ['libs'].map(Path.segment) }),
      false,
    ],
  ] as const)('%s', (_, child, parent, expected) => {
    expect(Path.isWithin(child as never, parent as never)).toBe(expected)
  })

  it('literal duality obeys the desugar law in both call shapes', () => {
    const relChild = Path.make('./a/b.txt')
    const relParent = Path.make('./a/')

    expect(Path.isWithin('./a/b.txt', './a/')).toBe(true)
    expect(Path.isWithin('./a/b.txt', './x/')).toBe(false)
    expect(Path.isWithin('/a/b.txt', '/a/')).toBe(true)

    expect(Path.isWithin('./a/b.txt', relParent)).toBe(Path.isWithin(relChild, relParent))
    expect(Path.isWithin(relChild, './a/')).toBe(Path.isWithin(relChild, relParent))
    expect(Path.isWithin('./a/b.txt', './a/')).toBe(Path.isWithin(relChild, relParent))
    expect(Path.isWithin('./a/')(relChild)).toBe(Path.isWithin(relParent)(relChild))
    expect(Path.isWithin(relParent)('./a/b.txt')).toBe(Path.isWithin(relParent)(relChild))

    expect(Path.isWithin('./a/b.txt', './x/')).toBe(
      Path.isWithin(Path.make('./a/b.txt'), Path.make('./x/')),
    )
    expect(Path.isWithin('/a/b.txt', '/a/')).toBe(
      Path.isWithin(Path.make('/a/b.txt'), Path.make('/a/')),
    )
  })

  it('literal desugaring agrees with generated directory values', () => {
    expect(Path.isWithin('/x/y.txt', '/x/')).toBe(true)

    assertProperty([arb.AbsDir], ([parent]) => {
      expect(Path.isWithin('/x/y.txt', parent)).toBe(Path.isWithin(Path.make('/x/y.txt'), parent))
      expect(Path.isWithin(parent)('/x/y.txt')).toBe(Path.isWithin(parent)(Path.make('/x/y.txt')))
    })
  })

  it('is descendant-or-directory-identity inclusive containment', () => {
    assertProperty([arb.Any, dir], ([child, parent]) => {
      expect(Path.isWithin(child as never, parent as never)).toBe(
        Path.isDescendantOf(child as never, parent as never) ||
          (Path.Dir.is(child) && Equal.equals(child, parent)),
      )
    })
  })

  it('includes directory identity', () => {
    assertProperty([dir], ([path]) => {
      expect(Path.isWithin(path, path)).toBe(true)
    })
  })

  it('types: every path position accepts values or literals and rejects invalid worlds', () => {
    expectTypeOf(Path.isWithin('/a/b.txt', '/a/')).toEqualTypeOf<boolean>()
    expectTypeOf(Path.isWithin('/a/b.txt', someAbsDir)).toEqualTypeOf<boolean>()
    expectTypeOf(Path.isWithin(someAbsFile, '/a/')).toEqualTypeOf<boolean>()
    expectTypeOf(Path.isWithin(someAbsFile, someAbsDir)).toEqualTypeOf<boolean>()

    expectTypeOf(Path.isWithin('/a/')('/a/b.txt')).toEqualTypeOf<boolean>()
    expectTypeOf(Path.isWithin('/a/')(someAbsFile)).toEqualTypeOf<boolean>()
    expectTypeOf(Path.isWithin(someAbsDir)('/a/b.txt')).toEqualTypeOf<boolean>()
    expectTypeOf(Path.isWithin(someAbsDir)(someAbsFile)).toEqualTypeOf<boolean>()

    const dynamic = '/a/' as string

    // Type-only: never executed, so the @ts-expect-error rejections cannot throw.
    const staticRejections = () => {
      // @ts-expect-error dynamic strings are rejected at the data-first child position
      Path.isWithin(dynamic, someAbsDir)
      // @ts-expect-error dynamic strings are rejected at the data-first parent position
      Path.isWithin(someAbsFile, dynamic)
      // @ts-expect-error dynamic strings are rejected at the data-last parent position
      Path.isWithin(dynamic)
      // @ts-expect-error dynamic strings are rejected at the data-last child position
      Path.isWithin(someAbsDir)(dynamic)
      // @ts-expect-error literal child and parent must belong to the same group
      Path.isWithin('/a/b.txt', './x/')
      // @ts-expect-error the curried literal child must match the literal parent's group
      Path.isWithin('./x/')('/a/b.txt')
      // @ts-expect-error value child and parent must belong to the same group
      Path.isWithin(someAbsFile, someRelDir)
      // @ts-expect-error the curried value child must match the value parent's group
      Path.isWithin(someRelDir)(someAbsFile)
    }
    expect(typeof staticRejections).toBe('function')
  })
})

describe('commonAncestor containment', () => {
  it('commonAncestor is total and returns an inclusive ancestor of same-group paths', () => {
    assertProperty([abs, abs], ([a, b]) => {
      const ab = Path.Abs.commonAncestor(a, b)
      const ba = Path.Abs.commonAncestor(b, a)

      expect(ab).toEqual(ba)
      expect(Path.isWithin(a, ab)).toBe(true)
      expect(Path.isWithin(b, ab)).toBe(true)
    })

    assertProperty([rel, rel], ([a, b]) => {
      const ab = Path.Rel.commonAncestor(a, b)
      const ba = Path.Rel.commonAncestor(b, a)

      expect(ab).toEqual(ba)
      expect(Path.isWithin(a, ab)).toBe(true)
      expect(Path.isWithin(b, ab)).toBe(true)
    })
  })
})

describe('finding 4: operations accept target-coercible dir literals like model make', () => {
  it('isWithin accepts a slashless dir parent literal', () => {
    expect(Path.isWithin('/foo/x', '/foo')).toBe(true)
  })
})

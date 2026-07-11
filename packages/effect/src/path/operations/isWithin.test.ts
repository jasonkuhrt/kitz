import { describe, expect, expectTypeOf, it } from '@kitz/vitest'
import { Equal, Schema as S } from 'effect'
import { FastCheck } from 'effect/testing'
import * as Path from '../__.js'

const arb = {
  Any: S.toArbitrary(Path.Any),
  AbsDir: S.toArbitrary(Path.AbsDir),
} as const
const arbAbsDir = arb.AbsDir
const arbAbsFile = S.toArbitrary(Path.AbsFile)
const arbRelDir = S.toArbitrary(Path.RelDir)
const arbRelFile = S.toArbitrary(Path.RelFile)
const abs = FastCheck.oneof(arbAbsDir, arbAbsFile)
const rel = FastCheck.oneof(arbRelDir, arbRelFile)
const dir = FastCheck.oneof(arbAbsDir, arbRelDir)

const someAbsFile = S.decodeSync(Path.AbsFile)('/home/src/index.ts')
const someAbsDir = S.decodeSync(Path.AbsDir)('/home/')
const someRelFile = S.decodeSync(Path.RelFile)('./src/index.ts')
const someRelDir = S.decodeSync(Path.RelDir)('./src/')

describe('isWithin', () => {
  it.each([
    [
      './a within ./',
      Path.RelDir.make({ ascent: 0, segments: ['a'].map(Path.segment) }),
      Path.RelDir.anchor,
      true,
    ],
    [
      './a within ../',
      Path.RelDir.make({ ascent: 0, segments: ['a'].map(Path.segment) }),
      Path.RelDir.make({ ascent: 1, segments: [] }),
      true,
    ],
    [
      '../x within ../../',
      Path.RelDir.make({ ascent: 1, segments: ['x'].map(Path.segment) }),
      Path.RelDir.make({ ascent: 2, segments: [] }),
      true,
    ],
    [
      '../a within ../b',
      Path.RelDir.make({ ascent: 1, segments: ['a'].map(Path.segment) }),
      Path.RelDir.make({ ascent: 1, segments: ['b'].map(Path.segment) }),
      false,
    ],
    ['../../ within ./', Path.RelDir.make({ ascent: 2, segments: [] }), Path.RelDir.anchor, false],
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
    const relChild = Path.mk('./a/b.txt')
    const relParent = Path.mk('./a/')

    expect(Path.isWithin('./a/b.txt', './a/')).toBe(true)
    expect(Path.isWithin('./a/b.txt', './x/')).toBe(false)
    expect(Path.isWithin('/a/b.txt', '/a/')).toBe(true)

    expect(Path.isWithin('./a/b.txt', relParent)).toBe(Path.isWithin(relChild, relParent))
    expect(Path.isWithin(relChild, './a/')).toBe(Path.isWithin(relChild, relParent))
    expect(Path.isWithin('./a/b.txt', './a/')).toBe(Path.isWithin(relChild, relParent))
    expect(Path.isWithin('./a/')(relChild)).toBe(Path.isWithin(relParent)(relChild))
    expect(Path.isWithin(relParent)('./a/b.txt')).toBe(Path.isWithin(relParent)(relChild))

    expect(Path.isWithin('./a/b.txt', './x/')).toBe(
      Path.isWithin(Path.mk('./a/b.txt'), Path.mk('./x/')),
    )
    expect(Path.isWithin('/a/b.txt', '/a/')).toBe(
      Path.isWithin(Path.mk('/a/b.txt'), Path.mk('/a/')),
    )
  })

  it('literal desugaring agrees with generated directory values', () => {
    expect(Path.isWithin('/x/y.txt', '/x/')).toBe(true)

    FastCheck.assert(
      FastCheck.property(arb.AbsDir, (parent) => {
        expect(Path.isWithin('/x/y.txt', parent)).toBe(Path.isWithin(Path.mk('/x/y.txt'), parent))
        expect(Path.isWithin(parent)('/x/y.txt')).toBe(Path.isWithin(parent)(Path.mk('/x/y.txt')))
      }),
    )
  })

  it('is descendant-or-directory-identity inclusive containment', () => {
    FastCheck.assert(
      FastCheck.property(arb.Any, dir, (child, parent) => {
        expect(Path.isWithin(child as never, parent as never)).toBe(
          Path.isDescendantOf(child as never, parent as never) ||
            (Path.Dir.is(child) && Equal.equals(child, parent)),
        )
      }),
    )
  })

  it('includes directory identity', () => {
    FastCheck.assert(
      FastCheck.property(dir, (path) => {
        expect(Path.isWithin(path, path)).toBe(true)
      }),
    )
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
    FastCheck.assert(
      FastCheck.property(abs, abs, (a, b) => {
        const ab = Path.Abs.commonAncestor(a, b)
        const ba = Path.Abs.commonAncestor(b, a)

        expect(ab).toEqual(ba)
        expect(Path.isWithin(a, ab)).toBe(true)
        expect(Path.isWithin(b, ab)).toBe(true)
      }),
    )

    FastCheck.assert(
      FastCheck.property(rel, rel, (a, b) => {
        const ab = Path.Rel.commonAncestor(a, b)
        const ba = Path.Rel.commonAncestor(b, a)

        expect(ab).toEqual(ba)
        expect(Path.isWithin(a, ab)).toBe(true)
        expect(Path.isWithin(b, ab)).toBe(true)
      }),
    )
  })
})

describe('finding 4: operations accept target-coercible dir literals like model mk', () => {
  it('isWithin accepts a slashless dir parent literal', () => {
    expect(Path.isWithin('/foo/x', '/foo')).toBe(true)
  })
})

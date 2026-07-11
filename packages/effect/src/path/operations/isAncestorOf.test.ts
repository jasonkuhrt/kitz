import { describe, expect, expectTypeOf, it } from '@kitz/vitest'
import { Schema as S } from 'effect'
import { FastCheck } from 'effect/testing'
import * as Path from '../__.js'

const arb = {
  Any: S.toArbitrary(Path.Any),
} as const
const arbAbsDir = S.toArbitrary(Path.AbsDir)
const arbRelDir = S.toArbitrary(Path.RelDir)
const dir = FastCheck.oneof(arbAbsDir, arbRelDir)

const someAbsFile = S.decodeSync(Path.AbsFile)('/home/src/index.ts')
const someAbsDir = S.decodeSync(Path.AbsDir)('/home/')
const someRelFile = S.decodeSync(Path.RelFile)('./src/index.ts')

describe('isAncestorOf', () => {
  it('literal duality obeys the desugar law in both call shapes', () => {
    const relParent = Path.make('./a/')
    const relChild = Path.make('./a/b.txt')
    const expected = Path.isAncestorOf(relParent, relChild)

    expect(expected).toBe(true)
    expect(Path.isAncestorOf('./a/', relChild)).toBe(expected)
    expect(Path.isAncestorOf(relParent, './a/b.txt')).toBe(expected)
    expect(Path.isAncestorOf('./a/', './a/b.txt')).toBe(expected)
    expect(Path.isAncestorOf('./a/b.txt')(relParent)).toBe(expected)
    expect(Path.isAncestorOf(relChild)('./a/')).toBe(expected)

    expect(Path.isAncestorOf('/a/', '/a/b.txt')).toBe(
      Path.isAncestorOf(Path.make('/a/'), Path.make('/a/b.txt')),
    )
    expect(Path.isAncestorOf('./a/', './a/')).toBe(false)
  })

  it('is the inverse of isDescendantOf', () => {
    FastCheck.assert(
      FastCheck.property(dir, arb.Any, (base, child) => {
        const sameGroup =
          (Path.AbsDir.is(base) && Path.Abs.is(child)) ||
          (Path.RelDir.is(base) && Path.Rel.is(child))
        if (!sameGroup) return

        expect(Path.isAncestorOf(base as never, child as never)).toBe(
          Path.isDescendantOf(child as never, base as never),
        )
      }),
    )
  })

  it('types: every path position accepts values or literals and rejects invalid worlds', () => {
    expectTypeOf(Path.isAncestorOf('/a/', '/a/b.txt')).toEqualTypeOf<boolean>()
    expectTypeOf(Path.isAncestorOf('/a/', someAbsFile)).toEqualTypeOf<boolean>()
    expectTypeOf(Path.isAncestorOf(someAbsDir, '/a/b.txt')).toEqualTypeOf<boolean>()
    expectTypeOf(Path.isAncestorOf(someAbsDir, someAbsFile)).toEqualTypeOf<boolean>()

    expectTypeOf(Path.isAncestorOf('/a/b.txt')('/a/')).toEqualTypeOf<boolean>()
    expectTypeOf(Path.isAncestorOf('/a/b.txt')(someAbsDir)).toEqualTypeOf<boolean>()
    expectTypeOf(Path.isAncestorOf(someAbsFile)('/a/')).toEqualTypeOf<boolean>()
    expectTypeOf(Path.isAncestorOf(someAbsFile)(someAbsDir)).toEqualTypeOf<boolean>()

    const dynamic = '/a/' as string

    // Type-only: never executed, so the @ts-expect-error rejections cannot throw.
    const staticRejections = () => {
      // @ts-expect-error dynamic strings are rejected at the data-first parent position
      Path.isAncestorOf(dynamic, someAbsFile)
      // @ts-expect-error dynamic strings are rejected at the data-first child position
      Path.isAncestorOf(someAbsDir, dynamic)
      // @ts-expect-error dynamic strings are rejected at the data-last child position
      Path.isAncestorOf(dynamic)
      // @ts-expect-error dynamic strings are rejected at the data-last parent position
      Path.isAncestorOf(someAbsFile)(dynamic)
      // @ts-expect-error parent and child literals must belong to the same group
      Path.isAncestorOf('/a/', './a/b.txt')
      // @ts-expect-error the curried parent literal must match the child literal's group
      Path.isAncestorOf('./a/b.txt')('/a/')
      // @ts-expect-error parent and child values must belong to the same group
      Path.isAncestorOf(someAbsDir, someRelFile)
      // @ts-expect-error the curried parent value must match the child value's group
      Path.isAncestorOf(someRelFile)(someAbsDir)
    }
    expect(typeof staticRejections).toBe('function')
  })
})

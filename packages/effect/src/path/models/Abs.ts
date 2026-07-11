import { Function as Fn, Schema as S } from 'effect'
import { withStatics } from '../../schema/withStatics.js'
import type { LiteralGuard } from '../core/literal.js'
import { relativeToAbsValue } from '../core/relativeTo.js'
import { commonSegmentPrefix } from '../core/segments.js'
import { withLiteralStatics } from '../core/statics.js'
import { AbsDir } from './AbsDir.js'
import { AbsFile } from './AbsFile.js'
import type { Rel } from './Rel.js'

/**
 * `Abs` — any absolute path (`AbsFile | AbsDir`), as a `string` ⇄ value codec.
 * Carries tagged-union utilities keyed by `_tag`: `cases`, `guards`, `isAnyOf`, `match`.
 */
const AbsTaggedUnion = S.Union([AbsFile, AbsDir]).pipe(S.toTaggedUnion('_tag'))

class Abs_ extends withLiteralStatics(
  withStatics(
    S.asClass(AbsTaggedUnion.pipe(S.overrideToFormatter(() => (path) => path.toString()))),
  ),
) {
  static readonly AbsFile = AbsFile
  static readonly AbsDir = AbsDir
  static readonly cases = AbsTaggedUnion.cases
  static readonly guards = AbsTaggedUnion.guards
  static readonly isAnyOf = AbsTaggedUnion.isAnyOf
  static readonly match = AbsTaggedUnion.match

  /**
   * The deepest common ancestor directory of two absolute paths. Total: `/`
   * is the floor when the paths share no named segment. Each path accepts an
   * absolute value or statically known absolute literal.
   */
  static readonly commonAncestor: {
    <const $A extends typeof Abs_.Type | string, const $B extends typeof Abs_.Type | string>(
      a: $A extends string ? LiteralGuard<$A, typeof Abs_.Type> : $A,
      b: $B extends string ? LiteralGuard<$B, typeof Abs_.Type> : $B,
    ): typeof AbsDir.Type
    <const $B extends typeof Abs_.Type | string>(
      b: $B extends string ? LiteralGuard<$B, typeof Abs_.Type> : $B,
    ): <const $A extends typeof Abs_.Type | string>(
      a: $A extends string ? LiteralGuard<$A, typeof Abs_.Type> : $A,
    ) => typeof AbsDir.Type
  } = Fn.dual(
    2,
    (a: typeof Abs_.Type | string, b: typeof Abs_.Type | string): typeof AbsDir.Type => {
      const aValue = typeof a === 'string' ? S.decodeSync(AbsTaggedUnion)(a) : a
      const bValue = typeof b === 'string' ? S.decodeSync(AbsTaggedUnion)(b) : b

      return AbsDir.make({ segments: commonSegmentPrefix(aValue.segments, bValue.segments) })
    },
  )

  /**
   * Express an absolute path relative to an absolute base directory. Total and
   * always produces a relative path. Dual: `Abs.relativeTo(path, base)` or
   * `Abs.relativeTo(base)(path)`.
   */
  static readonly relativeTo: {
    <
      const $Path extends typeof Abs_.Type | string,
      const $Base extends typeof AbsDir.Type | string,
    >(
      path: $Path extends string ? LiteralGuard<$Path, typeof Abs_.Type> : $Path,
      base: $Base extends string ? LiteralGuard<$Base, typeof AbsDir.Type> : $Base,
    ): Rel
    <const $Base extends typeof AbsDir.Type | string>(
      base: $Base extends string ? LiteralGuard<$Base, typeof AbsDir.Type> : $Base,
    ): <const $Path extends typeof Abs_.Type | string>(
      path: $Path extends string ? LiteralGuard<$Path, typeof Abs_.Type> : $Path,
    ) => Rel
  } = Fn.dual(2, (path: typeof Abs_.Type | string, base: typeof AbsDir.Type | string): Rel => {
    const pathValue: typeof Abs_.Type =
      typeof path === 'string' ? S.decodeSync(AbsTaggedUnion)(path) : path
    const baseValue: typeof AbsDir.Type =
      typeof base === 'string' ? S.decodeSync(AbsDir)(base) : base
    return relativeToAbsValue(pathValue, baseValue)
  })
}

export const Abs = Abs_
export type Abs = typeof Abs_.Type

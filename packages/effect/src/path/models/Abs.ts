import { Function as Fn, Schema as S } from 'effect'
import type { LiteralGuard } from '../core/literal.js'
import { commonSegmentPrefix } from '../core/segments.js'
import { withLiteralStatics, withStatics } from '../core/statics.js'
import { AbsDir } from './AbsDir.js'
import { AbsFile } from './AbsFile.js'

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
}

export const Abs = Abs_
export type Abs = typeof Abs_.Type

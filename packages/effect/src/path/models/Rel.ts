import { Function as Fn, Schema as S } from 'effect'
import { withStatics } from '../../schema/withStatics.js'
import type { LiteralGuard } from '../core/literal.js'
import { commonSegmentPrefix } from '../core/segments.js'
import { withLiteralStatics } from '../core/statics.js'
import { RelDir } from './RelDir.js'
import { RelFile } from './RelFile.js'

/**
 * `Rel` — any relative path (`RelFile | RelDir`), as a `string` ⇄ value codec.
 * Carries tagged-union utilities keyed by `_tag`: `cases`, `guards`, `isAnyOf`, `match`.
 */
const RelTaggedUnion = S.Union([RelFile, RelDir]).pipe(S.toTaggedUnion('_tag'))

class Rel_ extends withLiteralStatics(
  withStatics(
    S.asClass(RelTaggedUnion.pipe(S.overrideToFormatter(() => (path) => path.toString()))),
  ),
) {
  static readonly RelFile = RelFile
  static readonly RelDir = RelDir
  static readonly cases = RelTaggedUnion.cases
  static readonly guards = RelTaggedUnion.guards
  static readonly isAnyOf = RelTaggedUnion.isAnyOf
  static readonly match = RelTaggedUnion.match

  /**
   * The deepest common ancestor directory of two relative paths. Total: when
   * ascents differ, their common ancestor is the higher pure-ascent dir. Each
   * path accepts a relative value or statically known relative literal.
   */
  static readonly commonAncestor: {
    <const $A extends typeof Rel_.Type | string, const $B extends typeof Rel_.Type | string>(
      a: $A extends string ? LiteralGuard<$A, typeof Rel_.Type> : $A,
      b: $B extends string ? LiteralGuard<$B, typeof Rel_.Type> : $B,
    ): typeof RelDir.Type
    <const $B extends typeof Rel_.Type | string>(
      b: $B extends string ? LiteralGuard<$B, typeof Rel_.Type> : $B,
    ): <const $A extends typeof Rel_.Type | string>(
      a: $A extends string ? LiteralGuard<$A, typeof Rel_.Type> : $A,
    ) => typeof RelDir.Type
  } = Fn.dual(
    2,
    (a: typeof Rel_.Type | string, b: typeof Rel_.Type | string): typeof RelDir.Type => {
      const aValue = typeof a === 'string' ? S.decodeSync(RelTaggedUnion)(a) : a
      const bValue = typeof b === 'string' ? S.decodeSync(RelTaggedUnion)(b) : b

      return aValue.ascent === bValue.ascent
        ? RelDir.make({
            ascent: aValue.ascent,
            segments: commonSegmentPrefix(aValue.segments, bValue.segments),
          })
        : RelDir.make({ ascent: Math.max(aValue.ascent, bValue.ascent), segments: [] })
    },
  )
}

export const Rel = Rel_
export type Rel = typeof Rel_.Type

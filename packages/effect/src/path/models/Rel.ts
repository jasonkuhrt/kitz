import { Function as Fn, Schema as S } from 'effect'
import { commonSegmentPrefix } from '../core/segments.js'
import { withLiteralStatics, withStatics } from '../core/statics.js'
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
   * ascents differ, their common ancestor is the higher pure-ascent dir.
   */
  static readonly commonAncestor: {
    (a: typeof Rel_.Type, b: typeof Rel_.Type): typeof RelDir.Type
    (b: typeof Rel_.Type): (a: typeof Rel_.Type) => typeof RelDir.Type
  } = Fn.dual(2, (a: typeof Rel_.Type, b: typeof Rel_.Type): typeof RelDir.Type =>
    a.ascent === b.ascent
      ? RelDir.make({ ascent: a.ascent, segments: commonSegmentPrefix(a.segments, b.segments) })
      : RelDir.make({ ascent: Math.max(a.ascent, b.ascent), segments: [] }),
  )
}

export const Rel = Rel_
export type Rel = typeof Rel_.Type

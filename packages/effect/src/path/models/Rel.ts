import { Function as Fn, Option, Schema as S } from 'effect'
import { withStatics } from '../../schema/withStatics.js'
import type { LiteralGuard } from '../core/literal.js'
import { relativeToRelValue } from '../core/relativeTo.js'
import { commonSegmentPrefix } from '../core/segments.js'
import { withLiteralStatics } from '../core/statics.js'
import { Ascent } from './ascent.js'
import { RelDir } from './RelDir.js'
import { RelFile } from './RelFile.js'

type RelCommonAncestorLiteralGuard<$S extends string, $Target> = LiteralGuard<
  $S,
  $Target,
  'Path.Rel.commonAncestor'
>

type RelRelativeToLiteralGuard<$S extends string, $Target> = LiteralGuard<
  $S,
  $Target,
  'Path.Rel.relativeTo'
>

/**
 * `Rel` — any relative path (`RelFile | RelDir`), as a `string` ⇄ value codec.
 * Carries tagged-union utilities keyed by `_tag`: `cases`, `guards`, `isAnyOf`, `match`.
 */
const RelTaggedUnion = S.Union([RelFile, RelDir]).pipe(S.toTaggedUnion('_tag'))

class Rel_ extends withLiteralStatics(
  withStatics(RelTaggedUnion.pipe(S.overrideToFormatter(() => (path) => path.toString()))),
  'Path.Rel.make',
) {
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
      a: $A extends string ? RelCommonAncestorLiteralGuard<$A, typeof Rel_.Type> : $A,
      b: $B extends string ? RelCommonAncestorLiteralGuard<$B, typeof Rel_.Type> : $B,
    ): typeof RelDir.Type
    <const $B extends typeof Rel_.Type | string>(
      b: $B extends string ? RelCommonAncestorLiteralGuard<$B, typeof Rel_.Type> : $B,
    ): <const $A extends typeof Rel_.Type | string>(
      a: $A extends string ? RelCommonAncestorLiteralGuard<$A, typeof Rel_.Type> : $A,
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
        : RelDir.make({
            ascent: Ascent.make(Math.max(aValue.ascent, bValue.ascent)),
            segments: [],
          })
    },
  )

  /**
   * Express a relative path relative to a relative base directory. Returns
   * `None` when the target has a shallower unknown anchor than the base, or
   * when the walk up would exceed the 4096-step ascent ceiling. Dual:
   * `Rel.relativeTo(path, base)` or `Rel.relativeTo(base)(path)`.
   */
  static readonly relativeTo: {
    <
      const $Path extends typeof Rel_.Type | string,
      const $Base extends typeof RelDir.Type | string,
    >(
      path: $Path extends string ? RelRelativeToLiteralGuard<$Path, typeof Rel_.Type> : $Path,
      base: $Base extends string ? RelRelativeToLiteralGuard<$Base, typeof RelDir.Type> : $Base,
    ): Option.Option<typeof Rel_.Type>
    <const $Base extends typeof RelDir.Type | string>(
      base: $Base extends string ? RelRelativeToLiteralGuard<$Base, typeof RelDir.Type> : $Base,
    ): <const $Path extends typeof Rel_.Type | string>(
      path: $Path extends string ? RelRelativeToLiteralGuard<$Path, typeof Rel_.Type> : $Path,
    ) => Option.Option<typeof Rel_.Type>
  } = Fn.dual(
    2,
    (
      path: typeof Rel_.Type | string,
      base: typeof RelDir.Type | string,
    ): Option.Option<typeof Rel_.Type> => {
      const pathValue: typeof Rel_.Type =
        typeof path === 'string' ? S.decodeSync(RelTaggedUnion)(path) : path
      const baseValue: typeof RelDir.Type =
        typeof base === 'string' ? S.decodeSync(RelDir)(base) : base
      return relativeToRelValue(pathValue, baseValue)
    },
  )
}

export const Rel = Rel_
export type Rel = typeof Rel_.Type

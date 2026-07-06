import { Array, Function as Fn, Option } from 'effect'
import { type MatchingDirGroup, type MatchingTypeGroupForDir } from '../core/group.js'
import type { Any } from '../models/Any.js'
import type { Dir } from '../models/Dir.js'
import { isDescendantOf } from './isDescendantOf.js'

/**
 * The segments of `child` beneath `parent`, or `None` when not a descendant.
 * Dual: `(child, parent)` or `(parent)`.
 */
export const getRelativeSegments: {
  <A extends Any>(child: A, parent: MatchingDirGroup<A>): Option.Option<readonly string[]>
  <A extends Dir>(
    parent: A,
  ): (child: MatchingTypeGroupForDir<A>) => Option.Option<readonly string[]>
} = Fn.dual(
  2,
  (child: Any, parent: Dir): Option.Option<readonly string[]> =>
    isDescendantOf(child, parent)
      ? Option.some(Array.drop(child.segments, parent.segments.length))
      : Option.none(),
)

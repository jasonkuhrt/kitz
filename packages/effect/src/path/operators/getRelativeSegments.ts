import { Array, Function as Fn, Option } from 'effect'
import type { Dir } from '../models/Dir.js'
import type { Any } from '../models/Any.js'
import type { MatchingDirGroup, MatchingTypeGroupForDir } from './_group.js'
import { isDescendantOf } from './isDescendantOf.js'

/**
 * The segments of `child` beneath `parent`, or `None` when `child` is not a
 * descendant. Dual: `getRelativeSegments(child, parent)` or
 * `getRelativeSegments(parent)` for piping.
 */
export const getRelativeSegments: {
  <A extends Any>(child: A, parent: MatchingDirGroup<A>): Option.Option<readonly string[]>
  <A extends Dir>(
    parent: A,
  ): (child: MatchingTypeGroupForDir<A>) => Option.Option<readonly string[]>
} = Fn.dual(2, (child: Any, parent: Dir): Option.Option<readonly string[]> => {
  if (!isDescendantOf(child, parent as any)) return Option.none()
  return Option.some(Array.drop(child.segments, parent.segments.length))
})

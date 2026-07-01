import { Function as Fn } from 'effect'
import type { Dir } from '../models/Dir.js'
import type { Path } from '../models/Path.js'
import { isRel, type MatchingDirGroup, type MatchingTypeGroupForDir } from './_group.js'
import { isSegmentsStartsWith } from './isSegmentsStartsWith.js'

/**
 * Whether `child` lives under `parent`. Both must be the same group (absolute or
 * relative); relative paths must also share the same `back` reference depth.
 * Dual: `isDescendantOf(child, parent)` or `isDescendantOf(parent)` for piping.
 */
export const isDescendantOf: {
  <A extends Path>(child: A, parent: MatchingDirGroup<A>): boolean
  <A extends Dir>(parent: A): (child: MatchingTypeGroupForDir<A>) => boolean
} = Fn.dual(2, (child: Path, parent: Dir): boolean => {
  if (isRel(child) !== isRel(parent)) return false
  const childBack = isRel(child) ? child.back : 0
  const parentBack = isRel(parent) ? parent.back : 0
  if (childBack !== parentBack) return false
  if (child.segments.length < parent.segments.length) return false
  return isSegmentsStartsWith(child.segments, parent.segments)
})

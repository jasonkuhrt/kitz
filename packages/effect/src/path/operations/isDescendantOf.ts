import { Function as Fn } from 'effect'
import { isRel, type MatchingDirGroup, type MatchingTypeGroupForDir } from '../core/group.js'
import { isSegmentsStartsWith } from '../core/segments.js'
import type { Any } from '../models/Any.js'
import type { Dir } from '../models/Dir.js'

/**
 * Whether `child` lives under `parent`. Both must be the same group (absolute or
 * relative); relatives must share `ascent`. Dual: `(child, parent)` or `(parent)`.
 */
export const isDescendantOf: {
  <A extends Any>(child: A, parent: MatchingDirGroup<A>): boolean
  <A extends Dir>(parent: A): (child: MatchingTypeGroupForDir<A>) => boolean
} = Fn.dual(2, (child: Any, parent: Dir): boolean => {
  const childIsRel = isRel(child)
  const parentIsRel = isRel(parent)

  if (childIsRel !== parentIsRel) return false

  const childAscent = childIsRel ? child.ascent : 0
  const parentAscent = parentIsRel ? parent.ascent : 0
  if (childAscent !== parentAscent) return false
  if (child.segments.length < parent.segments.length) return false

  return isSegmentsStartsWith(child.segments, parent.segments)
})

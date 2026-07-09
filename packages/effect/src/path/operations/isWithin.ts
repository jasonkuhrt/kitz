import { Function as Fn } from 'effect'
import { isRel, type MatchingDirGroup, type MatchingTypeGroupForDir } from '../core/group.js'
import { isSegmentsStartsWith } from '../core/segments.js'
import type { Any } from '../models/Any.js'
import type { Dir } from '../models/Dir.js'

/**
 * Whether `child` is `parent` or lives under it — inclusive containment (the
 * analog of Python's `is_relative_to` / Rust's `starts_with`). For strict
 * containment see `isDescendantOf`. Both must be the same group (absolute or
 * relative); relatives must share `ascent`. Dual: `(child, parent)` or
 * `(parent)`.
 */
export const isWithin: {
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

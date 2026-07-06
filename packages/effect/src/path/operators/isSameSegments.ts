import { Function as Fn } from 'effect'
import { isRel, type MatchingTypeGroup } from '../core/group.js'
import { segmentsEquivalence } from '../core/segments.js'
import type { Any } from '../models/Any.js'

/** Whether two same-group paths have identical segments (and `back`). Dual. */
export const isSameSegments: {
  <A extends Any>(a: A, b: MatchingTypeGroup<A>): boolean
  <A extends Any>(b: A): (a: MatchingTypeGroup<A>) => boolean
} = Fn.dual(2, (a: Any, b: Any): boolean => {
  const aBack = isRel(a) ? a.back : 0
  const bBack = isRel(b) ? b.back : 0

  if (aBack !== bBack) return false

  return segmentsEquivalence(a.segments, b.segments)
})

import { Array, Equivalence, Function as Fn } from 'effect'
import type { Path } from '../models/Path.js'
import { isRel, type MatchingTypeGroup } from './_group.js'

const segmentsEquivalence = Array.makeEquivalence(Equivalence.String)

/**
 * Whether two same-group paths have identical segments (and `back`, for relative
 * paths). Dual: `isSameSegments(a, b)` or `isSameSegments(b)` for piping.
 */
export const isSameSegments: {
  <A extends Path>(a: A, b: MatchingTypeGroup<A>): boolean
  <A extends Path>(b: A): (a: MatchingTypeGroup<A>) => boolean
} = Fn.dual(2, (a: Path, b: Path): boolean => {
  const aBack = isRel(a) ? a.back : 0
  const bBack = isRel(b) ? b.back : 0
  if (aBack !== bBack) return false
  return segmentsEquivalence(a.segments, b.segments)
})

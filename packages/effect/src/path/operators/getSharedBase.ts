import { Function as Fn, Option } from 'effect'
import { isRel, type MatchingTypeGroup, type SharedBase } from '../core/group.js'
import { commonSegmentPrefix } from '../core/segments.js'
import type { Any } from '../models/Any.js'
import { AbsDir } from '../models/AbsDir.js'
import type { Dir } from '../models/Dir.js'
import { RelDir } from '../models/RelDir.js'

/**
 * The longest shared base directory of two same-group paths, or `None`. Dual:
 * `(a, b)` or `(b)`.
 */
export const getSharedBase: {
  <A extends Any>(a: A, b: MatchingTypeGroup<A>): Option.Option<SharedBase<A>>
  <A extends Any>(b: A): (a: MatchingTypeGroup<A>) => Option.Option<SharedBase<A>>
} = Fn.dual(2, (a: Any, b: Any): Option.Option<Dir> => {
  const aAscent = isRel(a) ? a.ascent : 0
  const bAscent = isRel(b) ? b.ascent : 0

  if (aAscent !== bAscent) return Option.none()

  const common = commonSegmentPrefix(a.segments, b.segments)
  if (common.length === 0) return Option.none()

  return isRel(a)
    ? Option.some(RelDir.make({ ascent: aAscent, segments: common }))
    : Option.some(AbsDir.make({ segments: common }))
})

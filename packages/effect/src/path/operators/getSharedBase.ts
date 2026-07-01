import { Function as Fn, Option } from 'effect'
import { AbsDir } from '../models/AbsDir.js'
import type { Dir } from '../models/Dir.js'
import type { Any } from '../models/Any.js'
import { RelDir } from '../models/RelDir.js'
import { isRel, type MatchingTypeGroup, type SharedBase } from '../core/group.js'
import { commonSegmentPrefix } from '../core/segments.js'

/**
 * The longest shared base directory of two same-group paths, or `None` when they
 * share no leading segments (or differ in `back`). Dual: `getSharedBase(a, b)` or
 * `getSharedBase(b)` for piping.
 */
export const getSharedBase: {
  <A extends Any>(a: A, b: MatchingTypeGroup<A>): Option.Option<SharedBase<A>>
  <A extends Any>(b: A): (a: MatchingTypeGroup<A>) => Option.Option<SharedBase<A>>
} = Fn.dual(2, (a: Any, b: Any): Option.Option<Dir> => {
  const aBack = isRel(a) ? a.back : 0
  const bBack = isRel(b) ? b.back : 0
  if (aBack !== bBack) return Option.none()

  const common = commonSegmentPrefix(a.segments, b.segments)
  if (common.length === 0) return Option.none()

  return isRel(a)
    ? Option.some(RelDir.make({ back: aBack, segments: common }))
    : Option.some(AbsDir.make({ segments: common }))
})

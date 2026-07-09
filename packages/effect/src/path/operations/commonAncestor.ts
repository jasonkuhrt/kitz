import { Function as Fn, Option } from 'effect'
import { isRel, type CommonAncestor, type MatchingTypeGroup } from '../core/group.js'
import { commonSegmentPrefix } from '../core/segments.js'
import type { Any } from '../models/Any.js'
import { AbsDir } from '../models/AbsDir.js'
import type { Dir } from '../models/Dir.js'
import { RelDir } from '../models/RelDir.js'

/**
 * The deepest common ancestor directory of two same-group paths, or `None`.
 * When `Some(d)`, both inputs satisfy `isWithin(x, d)`; a directory input may
 * itself be `d` because `isWithin` is inclusive. Dual: `(a, b)` or `(b)`.
 * Common-ancestor calculation is lexical; under symlinks a path outside the returned ancestor may still reach a file inside it.
 */
export const commonAncestor: {
  <A extends Any>(a: A, b: MatchingTypeGroup<A>): Option.Option<CommonAncestor<A>>
  <A extends Any>(b: A): (a: MatchingTypeGroup<A>) => Option.Option<CommonAncestor<A>>
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

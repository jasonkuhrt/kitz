import { Array, Equivalence, Function as Fn, Option, Schema as S } from 'effect'
import { Abs } from '../models/Abs.js'
import { AbsDir } from '../models/AbsDir.js'
import { Dir } from '../models/Dir.js'
import { Path } from '../models/Path.js'
import { Rel } from '../models/Rel.js'
import { RelDir } from '../models/RelDir.js'
import { commonSegmentPrefix } from './_segments.js'

const segmentsEquivalence = Array.makeEquivalence(Equivalence.String)
const isRel = S.is(Rel)

// ── Type utilities ──────────────────────────────────────────────────────────

/** Constrain a second path to the same group (absolute vs relative) as the first. */
export type MatchingTypeGroup<A extends Path> = {
  AbsFile: Abs
  AbsDir: Abs
  RelFile: Rel
  RelDir: Rel
}[A['_tag']]

/** The directory type of a path's own group — the type of a shared base. */
export type SharedBase<A extends Path> = {
  AbsFile: AbsDir
  AbsDir: AbsDir
  RelFile: RelDir
  RelDir: RelDir
}[A['_tag']]

/** Map any path to the directory type of its group (for ancestor / parent params). */
export type MatchingDirGroup<A extends Path> = {
  AbsFile: AbsDir
  AbsDir: AbsDir
  RelFile: RelDir
  RelDir: RelDir
}[A['_tag']]

/** Map a directory to its matching group (for child params when the parent is a `Dir`). */
export type MatchingTypeGroupForDir<A extends Dir> = {
  AbsDir: Abs
  RelDir: Rel
}[A['_tag']]

// ── Relationships (dual: data-first, or data-last for piping) ────────────────

/**
 * Whether `segments` begins with `prefix`. Dual: `isSegmentsStartsWith(segments,
 * prefix)` or `isSegmentsStartsWith(prefix)` for piping.
 */
export const isSegmentsStartsWith: {
  (segments: readonly string[], prefix: readonly string[]): boolean
  (prefix: readonly string[]): (segments: readonly string[]) => boolean
} = Fn.dual(2, (segments: readonly string[], prefix: readonly string[]): boolean => {
  if (prefix.length > segments.length) return false
  for (let i = 0; i < prefix.length; i++) {
    if (segments[i] !== prefix[i]) return false
  }
  return true
})

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

/**
 * Whether `parent` is above `child` — the inverse of {@link isDescendantOf}.
 * Dual: `isAncestorOf(parent, child)` or `isAncestorOf(child)` for piping.
 */
export const isAncestorOf: {
  <A extends Dir>(parent: A, child: MatchingTypeGroupForDir<A>): boolean
  <A extends Path>(child: A): (parent: MatchingDirGroup<A>) => boolean
} = Fn.dual(2, (parent: Dir, child: Path): boolean => isDescendantOf(child, parent as any))

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

/**
 * The segments of `child` beneath `parent`, or `None` when `child` is not a
 * descendant. Dual: `getRelativeSegments(child, parent)` or
 * `getRelativeSegments(parent)` for piping.
 */
export const getRelativeSegments: {
  <A extends Path>(child: A, parent: MatchingDirGroup<A>): Option.Option<readonly string[]>
  <A extends Dir>(
    parent: A,
  ): (child: MatchingTypeGroupForDir<A>) => Option.Option<readonly string[]>
} = Fn.dual(2, (child: Path, parent: Dir): Option.Option<readonly string[]> => {
  if (!isDescendantOf(child, parent as any)) return Option.none()
  return Option.some(Array.drop(child.segments, parent.segments.length))
})

/**
 * The longest shared base directory of two same-group paths, or `None` when they
 * share no leading segments (or differ in `back`). Dual: `getSharedBase(a, b)` or
 * `getSharedBase(b)` for piping.
 */
export const getSharedBase: {
  <A extends Path>(a: A, b: MatchingTypeGroup<A>): Option.Option<SharedBase<A>>
  <A extends Path>(b: A): (a: MatchingTypeGroup<A>) => Option.Option<SharedBase<A>>
} = Fn.dual(2, (a: Path, b: Path): Option.Option<Dir> => {
  const aBack = isRel(a) ? a.back : 0
  const bBack = isRel(b) ? b.back : 0
  if (aBack !== bBack) return Option.none()

  const common = commonSegmentPrefix(a.segments, b.segments)
  if (common.length === 0) return Option.none()

  return isRel(a)
    ? Option.some(RelDir.make({ back: aBack, segments: common }))
    : Option.some(AbsDir.make({ segments: common }))
})

import { Array, Function as Fn } from 'effect'
import type { Segment } from '../models/segment.js'

/**
 * The leading segments common to both arrays — their longest shared prefix.
 * Backs the shared-base and relative-walk computations.
 */
export const commonSegmentPrefix = (a: readonly Segment[], b: readonly Segment[]): Segment[] => {
  const common: Segment[] = []
  const max = Math.min(a.length, b.length)
  for (let i = 0; i < max && a[i] === b[i]; i++) common.push(a[i]!)
  return common
}

/** Move one level up in raw path data, growing `back` when there are no segments to drop. */
export const parentOf = (
  back: number,
  segments: readonly Segment[],
): { back: number; segments: readonly Segment[] } =>
  segments.length > 0
    ? { back, segments: Array.dropRight(segments, 1) }
    : { back: back + 1, segments: [] }

/**
 * Whether `segments` begins with `prefix`. Dual: `isSegmentsStartsWith(segments,
 * prefix)` or `isSegmentsStartsWith(prefix)` for piping.
 */
export const isSegmentsStartsWith: {
  (segments: readonly Segment[], prefix: readonly Segment[]): boolean
  (prefix: readonly Segment[]): (segments: readonly Segment[]) => boolean
} = Fn.dual(2, (segments: readonly Segment[], prefix: readonly Segment[]): boolean => {
  if (prefix.length > segments.length) return false
  for (let i = 0; i < prefix.length; i++) {
    if (segments[i] !== prefix[i]) return false
  }
  return true
})

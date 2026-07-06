import { Array, Equivalence, Function as Fn } from 'effect'

/**
 * The leading segments common to both arrays — their longest shared prefix.
 * Backs the shared-base and relative-walk computations.
 */
export const commonSegmentPrefix = (a: readonly string[], b: readonly string[]): string[] => {
  const common: string[] = []
  const max = Math.min(a.length, b.length)
  for (let i = 0; i < max && a[i] === b[i]; i++) common.push(a[i]!)
  return common
}

/** Move one level up in raw path data, growing `back` when there are no segments to drop. */
export const parentOf = (
  back: number,
  segments: readonly string[],
): { back: number; segments: readonly string[] } =>
  segments.length > 0
    ? { back, segments: Array.dropRight(segments, 1) }
    : { back: back + 1, segments: [] }

/** Structural equivalence for segment arrays. */
export const segmentsEquivalence = Array.makeEquivalence(Equivalence.String)

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

import { Function as Fn } from 'effect'

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

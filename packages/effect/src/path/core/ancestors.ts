import type { Segment } from '../models/segment.js'

/**
 * Segment prefixes for ancestor directories, ordered nearest-first.
 * Directories exclude themselves; files pass their containing-dir segments and
 * include that starting directory.
 */
export const ancestorSegments = (
  segments: readonly Segment[],
  options: { readonly includeSelf: boolean },
): readonly (readonly Segment[])[] => {
  const ancestors: (readonly Segment[])[] = []
  for (
    let length = options.includeSelf ? segments.length : segments.length - 1;
    length >= 0;
    length--
  ) {
    ancestors.push(segments.slice(0, length))
  }
  return ancestors
}

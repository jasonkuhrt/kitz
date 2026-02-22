import { Array, Equivalence, Match, Option } from 'effect'
import type { $Abs } from '../$Abs/_.js'
import type { $Dir } from '../$Dir/_.js'
import { $Rel } from '../$Rel/_.js'
import type { Path } from '../_.js'
import { AbsDir } from '../AbsDir/_.js'
import { RelDir } from '../RelDir/_.js'

// Create an equivalence for string arrays
const segmentsEquivalence = Array.getEquivalence(Equivalence.string)

// ============================================================================
// Type utilities
// ============================================================================

/**
 * Constrain second param to match first param's type group (abs vs rel).
 * Uses lookup table - handles unions via union of keys.
 */
export type MatchingTypeGroup<$a extends Path> = {
  FsPathRelFile: $Rel
  FsPathRelDir: $Rel
  FsPathAbsFile: $Abs
  FsPathAbsDir: $Abs
}[$a['_tag']]

/**
 * Return type for getSharedBase - directory of matching category.
 */
export type SharedBase<$a extends Path> = {
  FsPathRelFile: RelDir
  FsPathRelDir: RelDir
  FsPathAbsFile: AbsDir
  FsPathAbsDir: AbsDir
}[$a['_tag']]

/**
 * Maps any path to its matching directory type.
 * Used for parent parameters since files don't contain other paths.
 */
export type MatchingDirGroup<$a extends Path> = {
  FsPathRelFile: RelDir
  FsPathRelDir: RelDir
  FsPathAbsFile: AbsDir
  FsPathAbsDir: AbsDir
}[$a['_tag']]

/**
 * Maps a directory to its matching type group.
 * Used for child parameters when parent is constrained to $Dir.
 */
export type MatchingTypeGroupForDir<$a extends $Dir> = {
  FsPathRelDir: $Rel
  FsPathAbsDir: $Abs
}[$a['_tag']]

/**
 * Check if one path is a descendant of another path.
 * Both paths must be of the same type group (both absolute or both relative).
 *
 * @param child - The path that might be a descendant
 * @param parent - The path that might be an ancestor
 * @returns True if child is under parent, false otherwise
 *
 * @example
 * ```ts
 * const parent = FsLoc.Path.Abs.make({ segments: ['home', 'user'] })
 * const child = FsLoc.Path.Abs.make({ segments: ['home', 'user', 'docs'] })
 * isDescendantOf(child, parent) // true
 * ```
 */
export function isDescendantOf<$a extends Path>(child: $a, parent: MatchingDirGroup<$a>): boolean {
  // Can't compare paths of different types - check if tags match
  // Cast to Path for Match.tagsExhaustive since generic constraint is checked at call site
  const tagsMatch = Match.value(child as Path).pipe(
    Match.tagsExhaustive({
      FsPathAbsFile: () =>
        Match.value(parent as Path).pipe(
          Match.tag('FsPathAbsFile', () => true),
          Match.orElse(() => false),
        ),
      FsPathAbsDir: () =>
        Match.value(parent as Path).pipe(
          Match.tag('FsPathAbsDir', () => true),
          Match.orElse(() => false),
        ),
      FsPathRelFile: () =>
        Match.value(parent as Path).pipe(
          Match.tag('FsPathRelFile', () => true),
          Match.orElse(() => false),
        ),
      FsPathRelDir: () =>
        Match.value(parent as Path).pipe(
          Match.tag('FsPathRelDir', () => true),
          Match.orElse(() => false),
        ),
    }),
  )

  if (!tagsMatch) {
    return false
  }

  // For relative paths, back values must match (different back = different reference points)
  const childBack = $Rel.is(child) ? child.back : 0
  const parentBack = $Rel.is(parent) ? parent.back : 0
  if (childBack !== parentBack) {
    return false
  }

  const parentSegments = parent.segments
  const childSegments = child.segments

  // Child must have at least as many segments as parent
  if (childSegments.length < parentSegments.length) {
    return false
  }

  // Check if parent segments match the beginning of child segments
  return isSegmentsStartsWith(childSegments, parentSegments)
}

/**
 * Check if one path is an ancestor of another path.
 * Both paths must be of the same type group (both absolute or both relative).
 * This is the inverse of isDescendantOf.
 *
 * @param parent - The path that might be an ancestor
 * @param child - The path that might be a descendant
 * @returns True if parent is above child, false otherwise
 */
export function isAncestorOf<$a extends $Dir>(parent: $a, child: MatchingTypeGroupForDir<$a>): boolean {
  return isDescendantOf(child, parent as any)
}

/**
 * Check if one path starts with another path's segments.
 *
 * @param segments - The segments to check
 * @param prefix - The prefix segments to look for
 * @returns True if segments starts with prefix
 *
 * @example
 * ```ts
 * isSegmentsStartsWith(['a', 'b', 'c'], ['a', 'b']) // true
 * isSegmentsStartsWith(['a', 'b'], ['a', 'b', 'c']) // false
 * isSegmentsStartsWith(['x', 'y'], ['a', 'b']) // false
 * ```
 */
export function isSegmentsStartsWith(segments: readonly string[], prefix: readonly string[]): boolean {
  if (prefix.length > segments.length) {
    return false
  }

  for (let i = 0; i < prefix.length; i++) {
    const segment = segments[i]
    const prefixSegment = prefix[i]
    if (segment === undefined || prefixSegment === undefined || segment !== prefixSegment) {
      return false
    }
  }

  return true
}

/**
 * Check if two paths have the same segments and back values.
 * Both paths must be of the same type group (both absolute or both relative).
 *
 * @param a - First path
 * @param b - Second path
 * @returns True if paths have identical segments and back values
 */
export function isSameSegments<$a extends Path>(a: $a, b: MatchingTypeGroup<$a>): boolean {
  // For relative paths, back values must also match
  const aBack = $Rel.is(a) ? a.back : 0
  const bBack = $Rel.is(b) ? b.back : 0
  if (aBack !== bBack) {
    return false
  }
  return segmentsEquivalence(a.segments, b.segments)
}

/**
 * Get the relative path from one path to another.
 * Removes the ancestor path prefix from the descendant.
 * Both paths must be of the same type group (both absolute or both relative).
 * Returns null if child is not a descendant of parent.
 *
 * @param child - The descendant path
 * @param parent - The ancestor path
 * @returns The relative segments, or null if not a descendant
 *
 * @example
 * ```ts
 * const parent = FsLoc.Path.Abs.make({ segments: ['home', 'user'] })
 * const child = FsLoc.Path.Abs.make({ segments: ['home', 'user', 'docs', 'readme'] })
 * getRelativeSegments(child, parent) // ['docs', 'readme']
 * ```
 */
export function getRelativeSegments<$a extends Path>(
  child: $a,
  parent: MatchingDirGroup<$a>,
): readonly string[] | null {
  if (!isDescendantOf(child, parent as any)) {
    return null
  }

  return child.segments.slice(parent.segments.length)
}

/**
 * Find the shared base directory of two paths.
 * Both paths must be of the same type group (both absolute or both relative).
 * Returns None if paths have no common segments or different back values.
 *
 * @param a - First path
 * @param b - Second path
 * @returns Option containing the shared base directory, or None if no shared base
 *
 * @example
 * ```ts
 * const a = FsLoc.Path.Abs.make({ segments: ['home', 'user', 'docs'] })
 * const b = FsLoc.Path.Abs.make({ segments: ['home', 'user', 'pictures'] })
 * getSharedBase(a, b) // Option.some(AbsDir with segments ['home', 'user'])
 * ```
 */
export function getSharedBase<$a extends Path>(
  a: $a,
  b: MatchingTypeGroup<$a>,
): Option.Option<SharedBase<$a>> {
  // For relative paths, different back values means no shared base
  const aBack = $Rel.is(a) ? a.back : 0
  const bBack = $Rel.is(b) ? b.back : 0
  if (aBack !== bBack) {
    return Option.none()
  }

  const minLength = Math.min(a.segments.length, b.segments.length)
  const common: string[] = []

  for (let i = 0; i < minLength; i++) {
    const aSegment = a.segments[i]
    const bSegment = b.segments[i]
    if (aSegment !== undefined && bSegment !== undefined && aSegment === bSegment) {
      common.push(aSegment)
    } else {
      break
    }
  }

  // No common segments = no shared base
  if (common.length === 0) {
    return Option.none()
  }

  // Return appropriate directory type
  if ($Rel.is(a)) {
    return Option.some(RelDir.make({ back: aBack, segments: common })) as any
  }
  return Option.some(AbsDir.make({ segments: common })) as any
}

// ============================================================================
// Curried variants
// ============================================================================

/**
 * Curried variant of isDescendantOf - provide parent first, then child.
 * Parent must be a directory.
 */
export const isDescendantOfPath = <$a extends $Dir>(parent: $a) => (child: MatchingTypeGroupForDir<$a>): boolean =>
  isDescendantOf(child, parent as any)

/**
 * Curried variant of isAncestorOf - provide child first, then parent.
 * Parent must be a directory.
 */
export const isAncestorOfPath = <$a extends Path>(child: $a) => (parent: MatchingDirGroup<$a>): boolean =>
  isAncestorOf(parent as any, child as any)

/**
 * Curried variant of isSegmentsStartsWith - provide prefix first, then segments.
 */
export const isSegmentsStartsWithPrefix = (prefix: readonly string[]) => (segments: readonly string[]): boolean =>
  isSegmentsStartsWith(segments, prefix)

/**
 * Curried variant of isSameSegments - provide one path first, then the other.
 */
export const isSameSegmentsAs = <$a extends Path>(a: $a) => (b: MatchingTypeGroup<$a>): boolean =>
  isSameSegments(a, b as any)

/**
 * Curried variant of getRelativeSegments - provide parent first, then child.
 * Parent must be a directory.
 */
export const getRelativeSegmentsFrom =
  <$a extends $Dir>(parent: $a) => (child: MatchingTypeGroupForDir<$a>): readonly string[] | null =>
    getRelativeSegments(child, parent as any)

/**
 * Curried variant of getSharedBase - provide one path first, then the other.
 */
export const getSharedBaseWith =
  <$a extends Path>(a: $a) => (b: MatchingTypeGroup<$a>): Option.Option<SharedBase<$a>> => getSharedBase(a, b as any)

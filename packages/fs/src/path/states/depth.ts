import { $Rel } from '../$Rel/_.js'
import type { Path } from '../_.js'
import type { Input } from '../inputs.js'
import { normalizeDynamic } from '../inputs.js'
import { Schema } from '../Schema.js'

const normalizer = normalizeDynamic(Schema)

export type PathWithEmptySegments<T extends Path> = T & { segments: readonly [] }

/**
 * Type guard to check if a path is at root/base level.
 *
 * For absolute paths: true if segments is empty (at filesystem root `/`).
 * For relative paths: true if segments is empty AND back is 0 (at reference point `./`).
 * Paths with back > 0 (like `../`) are not considered root.
 *
 * @param path - The path to check (absolute or relative)
 * @returns True if the path is at root/base level
 *
 * @example
 * ```ts
 * isRoot('/') // true - at filesystem root
 * isRoot('./') // true - at reference point
 * isRoot('../') // false - above reference point
 * isRoot('./src/') // false - has segments
 * ```
 */
export function isRoot<$input extends Input>($input: $input): boolean {
  const path = normalizer($input) as Path
  // For relative paths, also check back is 0
  const back = $Rel.is(path) ? path.back : 0
  return path.segments.length === 0 && back === 0
}

/**
 * Type guard to check if a path is top-level (one segment).
 * Narrows the type to have exactly one segment.
 *
 * @param path - The path to check (absolute or relative)
 * @returns True if the path has exactly one segment
 *
 * @example
 * ```ts
 * const absPath = FsLoc.Path.Abs.make({ segments: ['docs'] })
 * if (isTop(absPath)) {
 *   // TypeScript knows: absPath.segments is readonly [string]
 *   const [segment] = absPath.segments // Safe!
 * }
 * ```
 */
export function isTop<T extends Path>(path: T): path is PathWithOneSegment<T> {
  return path.segments.length === 1
}

export type PathWithOneSegment<T extends Path> = T & { segments: readonly [string] }

/**
 * Type guard to check if a path is sub-level (more than one segment).
 * Narrows the type to have at least two segments.
 *
 * @param path - The path to check (absolute or relative)
 * @returns True if the path has more than one segment
 *
 * @example
 * ```ts
 * const absPath = FsLoc.Path.Abs.make({ segments: ['docs', 'guides', 'intro'] })
 * if (isSub(absPath)) {
 *   // TypeScript knows: absPath.segments is readonly [string, string, ...string[]]
 * }
 * ```
 */
export function isSub<T extends Path>(path: T): path is PathWithTwoOrMoreSegments<T> {
  return path.segments.length > 1
}

export type PathWithTwoOrMoreSegments<T extends Path> = T & { segments: readonly [string, string, ...string[]] }

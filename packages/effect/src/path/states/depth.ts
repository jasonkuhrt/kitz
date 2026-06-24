import type { Path } from '../_.js'
import { Rel } from '../models/Rel.js'

/**
 * Whether a path is at root/base level.
 *
 * For absolute paths: true if segments is empty (at filesystem root `/`).
 * For relative paths: true if segments is empty AND back is 0 (at reference point `./`).
 * Paths with back > 0 (like `../`) are not at root.
 */
export const isRoot = (path: Path): boolean => {
  const back = Rel.is(path) ? path.back : 0
  return path.segments.length === 0 && back === 0
}

/** Whether a path is top-level (exactly one segment). */
export const isTop = (path: Path): boolean => path.segments.length === 1

/** Whether a path is sub-level (more than one segment). */
export const isSub = (path: Path): boolean => path.segments.length > 1

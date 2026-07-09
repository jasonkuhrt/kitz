import { Function as Fn } from 'effect'
import { type MatchingDirGroup, type MatchingTypeGroupForDir } from '../core/group.js'
import type { Any } from '../models/Any.js'
import type { Dir } from '../models/Dir.js'
import { isDescendantOf } from './isDescendantOf.js'

/**
 * Whether `parent` is strictly above `child`; a path is not its own ancestor.
 * Mirrors `isDescendantOf`, including relative pure-ascent ancestors. Dual.
 * Containment is lexical; under symlinks a path outside `parent` may still reach a file inside it.
 */
export const isAncestorOf: {
  <A extends Dir>(parent: A, child: MatchingTypeGroupForDir<A>): boolean
  <A extends Any>(child: A): (parent: MatchingDirGroup<A>) => boolean
} = Fn.dual(2, (parent: Dir, child: Any): boolean => isDescendantOf(child, parent))

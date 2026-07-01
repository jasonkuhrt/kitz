import { Function as Fn } from 'effect'
import type { Dir } from '../models/Dir.js'
import type { Any } from '../models/Any.js'
import type { MatchingDirGroup, MatchingTypeGroupForDir } from './_group.js'
import { isDescendantOf } from './isDescendantOf.js'

/**
 * Whether `parent` is above `child` — the inverse of {@link isDescendantOf}.
 * Dual: `isAncestorOf(parent, child)` or `isAncestorOf(child)` for piping.
 */
export const isAncestorOf: {
  <A extends Dir>(parent: A, child: MatchingTypeGroupForDir<A>): boolean
  <A extends Any>(child: A): (parent: MatchingDirGroup<A>) => boolean
} = Fn.dual(2, (parent: Dir, child: Any): boolean => isDescendantOf(child, parent as any))

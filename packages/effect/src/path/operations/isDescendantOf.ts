import { Function as Fn } from 'effect'
import type { MatchingDirGroup, MatchingTypeGroupForDir } from '../core/group.js'
import type { Any } from '../models/Any.js'
import { Dir } from '../models/Dir.js'
import { isWithin } from './isWithin.js'

/**
 * Whether `child` lives strictly under `parent`; a path is not its own
 * descendant. Both must be the same group (absolute or relative); relatives
 * must share `ascent`. Dual: `(child, parent)` or `(parent)`.
 * Containment is lexical; under symlinks a path outside `parent` may still reach a file inside it.
 */
export const isDescendantOf: {
  <A extends Any>(child: A, parent: MatchingDirGroup<A>): boolean
  <A extends Dir>(parent: A): (child: MatchingTypeGroupForDir<A>) => boolean
} = Fn.dual(2, (child: Any, parent: Dir): boolean => {
  return (
    isWithin(child, parent) && !(Dir.is(child) && child.segments.length === parent.segments.length)
  )
})

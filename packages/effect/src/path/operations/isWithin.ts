import { Function as Fn, Schema as S } from 'effect'
import { isRel, type MatchingDirGroup, type MatchingTypeGroupForDir } from '../core/group.js'
import type { ErrorPathGroupMismatch, FromTargetLiteral, LiteralGuard } from '../core/literal.js'
import { isSegmentsStartsWith } from '../core/segments.js'
import { Any } from '../models/Any.js'
import { Dir } from '../models/Dir.js'

type ChildValue<$Child extends Any | string> = $Child extends string
  ? FromTargetLiteral<$Child, Any>
  : $Child

type ParentValue<$Parent extends Dir | string> = $Parent extends string
  ? FromTargetLiteral<$Parent, Dir>
  : $Parent

/**
 * Whether `child` is `parent` or lives under it — inclusive containment (the
 * analog of Python's `is_relative_to` / Rust's `starts_with`). For strict
 * containment see `isDescendantOf`. Both must be the same group (absolute or
 * relative). Relatives share `ascent`, except pure-ascent dirs (`../`,
 * `../../`, ...) also contain paths in their lower cone, e.g. `./a` is within
 * `../`. Every path position accepts either a decoded value or a statically
 * known string literal; literals desugar through `Path.mk`, while dynamic
 * strings are rejected. Dual: `(child, parent)` or `(parent)`.
 * Containment is lexical; under symlinks a path outside `parent` may still reach a file inside it.
 */
export const isWithin: {
  <const $Child extends Any | string, const $Parent extends Dir | string>(
    child: $Child extends string ? LiteralGuard<$Child, Any> : $Child,
    parent: $Parent extends string
      ? LiteralGuard<$Parent, MatchingDirGroup<ChildValue<$Child>>>
      : $Parent extends MatchingDirGroup<ChildValue<$Child>>
        ? $Parent
        : ErrorPathGroupMismatch,
  ): boolean
  <const $Parent extends Dir | string>(
    parent: $Parent extends string ? LiteralGuard<$Parent, Dir> : $Parent,
  ): <const $Child extends Any | string>(
    child: $Child extends string
      ? LiteralGuard<$Child, MatchingTypeGroupForDir<ParentValue<$Parent>>>
      : $Child extends MatchingTypeGroupForDir<ParentValue<$Parent>>
        ? $Child
        : ErrorPathGroupMismatch,
  ) => boolean
} = Fn.dual(2, (child: Any | string, parent: Dir | string): boolean => {
  const childPath = typeof child === 'string' ? S.decodeSync(Any)(child) : child
  const parentPath: Dir = typeof parent === 'string' ? (S.decodeSync(Dir)(parent) as any) : parent
  const childIsRel = isRel(childPath)
  const parentIsRel = isRel(parentPath)

  if (childIsRel !== parentIsRel) return false

  const childAscent = childIsRel ? childPath.ascent : 0
  const parentAscent = parentIsRel ? parentPath.ascent : 0
  if (childIsRel && parentPath.segments.length === 0 && parentAscent >= childAscent) return true
  if (childAscent !== parentAscent) return false
  if (childPath.segments.length < parentPath.segments.length) return false

  return isSegmentsStartsWith(childPath.segments, parentPath.segments)
})

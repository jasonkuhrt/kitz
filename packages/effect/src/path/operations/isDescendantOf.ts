import { Function as Fn, Schema as S } from 'effect'
import { isRel, type MatchingDirGroup, type MatchingTypeGroupForDir } from '../core/group.js'
import type { ErrorPathGroupMismatch, FromTargetLiteral, LiteralGuard } from '../core/literal.js'
import { Any } from '../models/Any.js'
import { Dir } from '../models/Dir.js'
import { isWithin } from './isWithin.js'

type IsDescendantOfLiteralGuard<$S extends string, $Target> = LiteralGuard<
  $S,
  $Target,
  'Path.isDescendantOf'
>

type ChildValue<$Child extends Any | string> = $Child extends string
  ? FromTargetLiteral<$Child, Any>
  : $Child

type ParentValue<$Parent extends Dir | string> = $Parent extends string
  ? FromTargetLiteral<$Parent, Dir>
  : $Parent

/**
 * Whether `child` lives strictly under `parent`; a path is not its own
 * descendant. Both must be the same group (absolute or relative). Relatives
 * share `ascent`, except pure-ascent dirs (`../`, `../../`, ...) are strict
 * ancestors of paths in their lower cone. Every path position accepts either
 * a decoded value or a statically known string literal; literals desugar
 * through `Path.make`, while dynamic strings are rejected. Dual:
 * `(child, parent)` or `(parent)`.
 * Containment is lexical; under symlinks a path outside `parent` may still reach a file inside it.
 */
export const isDescendantOf: {
  <const $Child extends Any | string, const $Parent extends Dir | string>(
    child: $Child extends string ? IsDescendantOfLiteralGuard<$Child, Any> : $Child,
    parent: $Parent extends string
      ? IsDescendantOfLiteralGuard<$Parent, MatchingDirGroup<ChildValue<$Child>>>
      : $Parent extends MatchingDirGroup<ChildValue<$Child>>
        ? $Parent
        : ErrorPathGroupMismatch,
  ): boolean
  <const $Parent extends Dir | string>(
    parent: $Parent extends string ? IsDescendantOfLiteralGuard<$Parent, Dir> : $Parent,
  ): <const $Child extends Any | string>(
    child: $Child extends string
      ? IsDescendantOfLiteralGuard<$Child, MatchingTypeGroupForDir<ParentValue<$Parent>>>
      : $Child extends MatchingTypeGroupForDir<ParentValue<$Parent>>
        ? $Child
        : ErrorPathGroupMismatch,
  ) => boolean
} = Fn.dual(2, (child: Any | string, parent: Dir | string): boolean => {
  const childPath = typeof child === 'string' ? S.decodeSync(Any)(child) : child
  const parentPath: Dir = typeof parent === 'string' ? (S.decodeSync(Dir)(parent) as any) : parent
  const childAscent = isRel(childPath) ? childPath.ascent : 0
  const parentAscent = isRel(parentPath) ? parentPath.ascent : 0

  return (
    isWithin(childPath, parentPath) &&
    !(
      Dir.is(childPath) &&
      childAscent === parentAscent &&
      childPath.segments.length === parentPath.segments.length
    )
  )
})

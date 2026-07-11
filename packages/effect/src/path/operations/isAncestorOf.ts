import { Function as Fn, Schema as S } from 'effect'
import { type MatchingDirGroup, type MatchingTypeGroupForDir } from '../core/group.js'
import type { ErrorPathGroupMismatch, FromTargetLiteral, LiteralGuard } from '../core/literal.js'
import { Any } from '../models/Any.js'
import { Dir } from '../models/Dir.js'
import { isDescendantOf } from './isDescendantOf.js'

type ChildValue<$Child extends Any | string> = $Child extends string
  ? FromTargetLiteral<$Child, Any>
  : $Child

type ParentValue<$Parent extends Dir | string> = $Parent extends string
  ? FromTargetLiteral<$Parent, Dir>
  : $Parent

/**
 * Whether `parent` is strictly above `child`; a path is not its own ancestor.
 * Mirrors `isDescendantOf`, including relative pure-ascent ancestors. Every
 * path position accepts either a decoded value or a statically known string
 * literal; literals desugar through `Path.mk`, while dynamic strings are
 * rejected. Dual: `(parent, child)` or `(child)`.
 * Containment is lexical; under symlinks a path outside `parent` may still reach a file inside it.
 */
export const isAncestorOf: {
  <const $Parent extends Dir | string, const $Child extends Any | string>(
    parent: $Parent extends string ? LiteralGuard<$Parent, Dir> : $Parent,
    child: $Child extends string
      ? LiteralGuard<$Child, MatchingTypeGroupForDir<ParentValue<$Parent>>>
      : $Child extends MatchingTypeGroupForDir<ParentValue<$Parent>>
        ? $Child
        : ErrorPathGroupMismatch,
  ): boolean
  <const $Child extends Any | string>(
    child: $Child extends string ? LiteralGuard<$Child, Any> : $Child,
  ): <const $Parent extends Dir | string>(
    parent: $Parent extends string
      ? LiteralGuard<$Parent, MatchingDirGroup<ChildValue<$Child>>>
      : $Parent extends MatchingDirGroup<ChildValue<$Child>>
        ? $Parent
        : ErrorPathGroupMismatch,
  ) => boolean
} = Fn.dual(2, (parent: Dir | string, child: Any | string): boolean => {
  const parentPath: Dir = typeof parent === 'string' ? (S.decodeSync(Dir)(parent) as any) : parent
  const childPath = typeof child === 'string' ? S.decodeSync(Any)(child) : child

  return isDescendantOf(childPath, parentPath)
})

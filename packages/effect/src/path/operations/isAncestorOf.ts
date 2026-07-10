import { Function as Fn, Schema as S } from 'effect'
import { type MatchingDirGroup, type MatchingTypeGroupForDir } from '../core/group.js'
import type {
  ErrorPathValidation,
  FromLiteral,
  LiteralGuard,
  LiteralInput,
} from '../core/literal.js'
import { Any } from '../models/Any.js'
import { Dir } from '../models/Dir.js'
import { isDescendantOf } from './isDescendantOf.js'

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
    parent: $Parent extends string
      ? string extends $Parent
        ? LiteralInput<$Parent>
        : [FromLiteral<$Parent>] extends [never]
          ? ErrorPathValidation<Dir, $Parent>
          : FromLiteral<$Parent> extends Dir
            ? $Parent
            : ErrorPathValidation<Dir, $Parent>
      : $Parent,
    child: $Child extends string
      ? string extends $Child
        ? LiteralInput<$Child>
        : [FromLiteral<$Child>] extends [never]
          ? ErrorPathValidation<
              MatchingTypeGroupForDir<
                Extract<$Parent extends string ? FromLiteral<$Parent> : $Parent, Dir>
              >,
              $Child
            >
          : FromLiteral<$Child> extends MatchingTypeGroupForDir<
                Extract<$Parent extends string ? FromLiteral<$Parent> : $Parent, Dir>
              >
            ? $Child
            : ErrorPathValidation<
                MatchingTypeGroupForDir<
                  Extract<$Parent extends string ? FromLiteral<$Parent> : $Parent, Dir>
                >,
                $Child
              >
      : $Child &
          MatchingTypeGroupForDir<
            Extract<$Parent extends string ? FromLiteral<$Parent> : $Parent, Dir>
          >,
  ): boolean
  <const $Child extends Any | string>(
    child: $Child extends string ? LiteralGuard<$Child, Any> : $Child,
  ): <const $Parent extends Dir | string>(
    parent: $Parent extends string
      ? string extends $Parent
        ? LiteralInput<$Parent>
        : [FromLiteral<$Parent>] extends [never]
          ? ErrorPathValidation<
              MatchingDirGroup<$Child extends string ? FromLiteral<$Child> : $Child>,
              $Parent
            >
          : FromLiteral<$Parent> extends MatchingDirGroup<
                $Child extends string ? FromLiteral<$Child> : $Child
              >
            ? $Parent
            : ErrorPathValidation<
                MatchingDirGroup<$Child extends string ? FromLiteral<$Child> : $Child>,
                $Parent
              >
      : $Parent & MatchingDirGroup<$Child extends string ? FromLiteral<$Child> : $Child>,
  ) => boolean
} = Fn.dual(2, (parent: Dir | string, child: Any | string): boolean => {
  const parentPath = typeof parent === 'string' ? (S.decodeSync(Any)(parent) as Dir) : parent
  const childPath = typeof child === 'string' ? S.decodeSync(Any)(child) : child

  return isDescendantOf(childPath, parentPath)
})

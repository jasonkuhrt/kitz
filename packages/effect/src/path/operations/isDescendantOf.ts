import { Function as Fn, Schema as S } from 'effect'
import { isRel, type MatchingDirGroup, type MatchingTypeGroupForDir } from '../core/group.js'
import type {
  ErrorPathValidation,
  FromLiteral,
  LiteralGuard,
  LiteralInput,
} from '../core/literal.js'
import { Any } from '../models/Any.js'
import { Dir } from '../models/Dir.js'
import { isWithin } from './isWithin.js'

/**
 * Whether `child` lives strictly under `parent`; a path is not its own
 * descendant. Both must be the same group (absolute or relative). Relatives
 * share `ascent`, except pure-ascent dirs (`../`, `../../`, ...) are strict
 * ancestors of paths in their lower cone. Every path position accepts either
 * a decoded value or a statically known string literal; literals desugar
 * through `Path.mk`, while dynamic strings are rejected. Dual:
 * `(child, parent)` or `(parent)`.
 * Containment is lexical; under symlinks a path outside `parent` may still reach a file inside it.
 */
export const isDescendantOf: {
  <const Child extends Any | string, const Parent extends Dir | string>(
    child: Child extends string ? LiteralGuard<Child, Any> : Child,
    parent: Parent extends string
      ? string extends Parent
        ? LiteralInput<Parent>
        : [FromLiteral<Parent>] extends [never]
          ? ErrorPathValidation<
              MatchingDirGroup<Child extends string ? FromLiteral<Child> : Child>,
              Parent
            >
          : FromLiteral<Parent> extends MatchingDirGroup<
                Child extends string ? FromLiteral<Child> : Child
              >
            ? Parent
            : ErrorPathValidation<
                MatchingDirGroup<Child extends string ? FromLiteral<Child> : Child>,
                Parent
              >
      : Parent & MatchingDirGroup<Child extends string ? FromLiteral<Child> : Child>,
  ): boolean
  <const Parent extends Dir | string>(
    parent: Parent extends string
      ? string extends Parent
        ? LiteralInput<Parent>
        : [FromLiteral<Parent>] extends [never]
          ? ErrorPathValidation<Dir, Parent>
          : FromLiteral<Parent> extends Dir
            ? Parent
            : ErrorPathValidation<Dir, Parent>
      : Parent,
  ): <const Child extends Any | string>(
    child: Child extends string
      ? string extends Child
        ? LiteralInput<Child>
        : [FromLiteral<Child>] extends [never]
          ? ErrorPathValidation<
              MatchingTypeGroupForDir<
                Extract<Parent extends string ? FromLiteral<Parent> : Parent, Dir>
              >,
              Child
            >
          : FromLiteral<Child> extends MatchingTypeGroupForDir<
                Extract<Parent extends string ? FromLiteral<Parent> : Parent, Dir>
              >
            ? Child
            : ErrorPathValidation<
                MatchingTypeGroupForDir<
                  Extract<Parent extends string ? FromLiteral<Parent> : Parent, Dir>
                >,
                Child
              >
      : Child &
          MatchingTypeGroupForDir<
            Extract<Parent extends string ? FromLiteral<Parent> : Parent, Dir>
          >,
  ) => boolean
} = Fn.dual(2, (child: Any | string, parent: Dir | string): boolean => {
  const childPath = typeof child === 'string' ? S.decodeSync(Any)(child) : child
  const parentPath = typeof parent === 'string' ? (S.decodeSync(Any)(parent) as Dir) : parent
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

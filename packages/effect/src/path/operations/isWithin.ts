import { Function as Fn, Schema as S } from 'effect'
import { isRel, type MatchingDirGroup, type MatchingTypeGroupForDir } from '../core/group.js'
import type {
  ErrorPathValidation,
  FromLiteral,
  LiteralGuard,
  LiteralInput,
} from '../core/literal.js'
import { isSegmentsStartsWith } from '../core/segments.js'
import { Any } from '../models/Any.js'
import type { Dir } from '../models/Dir.js'

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
  ): boolean
  <const $Parent extends Dir | string>(
    parent: $Parent extends string
      ? string extends $Parent
        ? LiteralInput<$Parent>
        : [FromLiteral<$Parent>] extends [never]
          ? ErrorPathValidation<Dir, $Parent>
          : FromLiteral<$Parent> extends Dir
            ? $Parent
            : ErrorPathValidation<Dir, $Parent>
      : $Parent,
  ): <const $Child extends Any | string>(
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
  ) => boolean
} = Fn.dual(2, (child: Any | string, parent: Dir | string): boolean => {
  const childPath = typeof child === 'string' ? S.decodeSync(Any)(child) : child
  const parentPath: Dir = typeof parent === 'string' ? (S.decodeSync(Any)(parent) as any) : parent
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

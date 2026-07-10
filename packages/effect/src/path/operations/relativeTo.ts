import { Array, Function as Fn, Option, Schema as S } from 'effect'
import { type MatchingDirGroup, type MatchingTypeGroupForDir } from '../core/group.js'
import type {
  ErrorPathValidation,
  FromLiteral,
  LiteralGuard,
  LiteralInput,
} from '../core/literal.js'
import { commonSegmentPrefix } from '../core/segments.js'
import type { Segment } from '../models/segment.js'
import type { Abs } from '../models/Abs.js'
import { AbsDir } from '../models/AbsDir.js'
import { AbsFile } from '../models/AbsFile.js'
import { Any } from '../models/Any.js'
import type { Dir } from '../models/Dir.js'
import { RelDir } from '../models/RelDir.js'
import type { Rel } from '../models/Rel.js'
import { RelFile } from '../models/RelFile.js'

/** Type-level {@link relativeTo}: maps a path variant to its relative counterpart. */
export type RelativeTo<$A extends Abs | Rel> = $A extends AbsFile
  ? RelFile
  : $A extends RelFile
    ? RelFile
    : $A extends AbsDir
      ? RelDir
      : $A extends RelDir
        ? RelDir
        : Rel

/**
 * Express a same-group path relative to `base`, walking up out of `base` with
 * `..` for the segments they don't share. For absolute paths this is total. For
 * relative paths this returns `None` exactly when `target.ascent < base.ascent`,
 * because joining from a relative base cannot move to a shallower unknown
 * anchor. Otherwise it satisfies `join(base, relativeTo(target, base)) ===
 * target`.
 *
 * Rel×rel case analysis:
 * - `target.ascent === base.ascent`: share the known segment prefix and walk up
 *   from the unshared base suffix.
 * - `target.ascent > base.ascent`: walk up out of every base segment, then up
 *   the ascent difference; no known segments can be shared.
 * - `target.ascent < base.ascent`: not expressible from the available relative
 *   path data, so return `None`.
 *
 * Every path position accepts either a decoded value or a statically known
 * string literal; literals desugar through `Path.mk`, while dynamic strings
 * are rejected. Dual: `relativeTo(path, base)` or `relativeTo(base)` for
 * piping.
 *
 * @example
 * ```ts
 * relativeTo(AbsFile '/home/user/src/index.ts', AbsDir '/home/user') // ./src/index.ts
 * pipe(absFile, relativeTo(base))                                    // same, data-last
 * ```
 */
export const relativeTo: {
  <const $Path extends Any | string, const $Base extends Dir | string>(
    path: $Path extends string ? LiteralGuard<$Path, Any> : $Path,
    base: $Base extends string
      ? string extends $Base
        ? LiteralInput<$Base>
        : [FromLiteral<$Base>] extends [never]
          ? ErrorPathValidation<
              MatchingDirGroup<$Path extends string ? FromLiteral<$Path> : $Path>,
              $Base
            >
          : FromLiteral<$Base> extends MatchingDirGroup<
                $Path extends string ? FromLiteral<$Path> : $Path
              >
            ? $Base
            : ErrorPathValidation<
                MatchingDirGroup<$Path extends string ? FromLiteral<$Path> : $Path>,
                $Base
              >
      : $Base & MatchingDirGroup<$Path extends string ? FromLiteral<$Path> : $Path>,
  ): ($Path extends string ? FromLiteral<$Path> : $Path) extends infer $PathValue extends Any
    ? [$PathValue] extends [Rel]
      ? Option.Option<RelativeTo<$PathValue>>
      : RelativeTo<$PathValue>
    : never
  <const $Base extends Dir | string>(
    base: $Base extends string
      ? string extends $Base
        ? LiteralInput<$Base>
        : [FromLiteral<$Base>] extends [never]
          ? ErrorPathValidation<Dir, $Base>
          : FromLiteral<$Base> extends Dir
            ? $Base
            : ErrorPathValidation<Dir, $Base>
      : $Base,
  ): <const $Path extends Any | string>(
    path: $Path extends string
      ? string extends $Path
        ? LiteralInput<$Path>
        : [FromLiteral<$Path>] extends [never]
          ? ErrorPathValidation<
              MatchingTypeGroupForDir<
                Extract<$Base extends string ? FromLiteral<$Base> : $Base, Dir>
              >,
              $Path
            >
          : FromLiteral<$Path> extends MatchingTypeGroupForDir<
                Extract<$Base extends string ? FromLiteral<$Base> : $Base, Dir>
              >
            ? $Path
            : ErrorPathValidation<
                MatchingTypeGroupForDir<
                  Extract<$Base extends string ? FromLiteral<$Base> : $Base, Dir>
                >,
                $Path
              >
      : $Path &
          MatchingTypeGroupForDir<Extract<$Base extends string ? FromLiteral<$Base> : $Base, Dir>>,
  ) => ($Path extends string ? FromLiteral<$Path> : $Path) extends infer $PathValue extends Any
    ? [$PathValue] extends [Rel]
      ? Option.Option<RelativeTo<$PathValue>>
      : RelativeTo<$PathValue>
    : never
} = Fn.dual(2, (path: Any | string, base: Dir | string): Rel | Option.Option<Rel> => {
  const pathValue = typeof path === 'string' ? S.decodeSync(Any)(path) : path
  const baseValue = typeof base === 'string' ? (S.decodeSync(Any)(base) as Dir) : base

  if (baseValue._tag === 'RelDir') return relativeToRel(pathValue as Rel, baseValue)
  return relativeToAbs(pathValue as Abs, baseValue)
})

const makeRel = (path: Abs | Rel, ascent: number, segments: readonly Segment[]): Rel =>
  path._tag === 'AbsFile' || path._tag === 'RelFile'
    ? RelFile.make({ dir: RelDir.make({ ascent, segments }), fileName: path.fileName })
    : RelDir.make({ ascent, segments })

const relativeToAbs = (abs: Abs, base: AbsDir): Rel => {
  const shared = commonSegmentPrefix(abs.segments, base.segments).length
  const ascent = base.segments.length - shared
  const segments = Array.drop(abs.segments, shared)
  return makeRel(abs, ascent, segments)
}

const relativeToRel = (rel: Rel, base: RelDir): Option.Option<Rel> => {
  if (rel.ascent < base.ascent) return Option.none()

  if (rel.ascent > base.ascent) {
    return Option.some(
      makeRel(rel, base.segments.length + (rel.ascent - base.ascent), rel.segments),
    )
  }

  const shared = commonSegmentPrefix(rel.segments, base.segments).length
  const ascent = base.segments.length - shared
  const segments = Array.drop(rel.segments, shared)
  return Option.some(makeRel(rel, ascent, segments))
}

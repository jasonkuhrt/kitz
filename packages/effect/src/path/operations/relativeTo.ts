import { Array, Function as Fn, Option, Schema as S } from 'effect'
import { type MatchingDirGroup, type MatchingTypeGroupForDir } from '../core/group.js'
import type { ErrorPathGroupMismatch, FromTargetLiteral, LiteralGuard } from '../core/literal.js'
import { commonSegmentPrefix } from '../core/segments.js'
import type { Segment } from '../models/segment.js'
import type { Abs } from '../models/Abs.js'
import { AbsDir } from '../models/AbsDir.js'
import { AbsFile } from '../models/AbsFile.js'
import { Any } from '../models/Any.js'
import { Dir } from '../models/Dir.js'
import { RelDir } from '../models/RelDir.js'
import type { Rel } from '../models/Rel.js'
import { RelFile } from '../models/RelFile.js'

type PathValue<$Path extends Any | string> = $Path extends string
  ? FromTargetLiteral<$Path, Any>
  : $Path

type BaseValue<$Base extends Dir | string> = $Base extends string
  ? FromTargetLiteral<$Base, Dir>
  : $Base

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
      ? LiteralGuard<$Base, MatchingDirGroup<PathValue<$Path>>>
      : $Base extends MatchingDirGroup<PathValue<$Path>>
        ? $Base
        : ErrorPathGroupMismatch,
  ): PathValue<$Path> extends infer $PathValue extends Any
    ? [$PathValue] extends [Rel]
      ? Option.Option<RelativeTo<$PathValue>>
      : RelativeTo<$PathValue>
    : never
  <const $Base extends Dir | string>(
    base: $Base extends string ? LiteralGuard<$Base, Dir> : $Base,
  ): <const $Path extends Any | string>(
    path: $Path extends string
      ? LiteralGuard<$Path, MatchingTypeGroupForDir<BaseValue<$Base>>>
      : $Path extends MatchingTypeGroupForDir<BaseValue<$Base>>
        ? $Path
        : ErrorPathGroupMismatch,
  ) => PathValue<$Path> extends infer $PathValue extends Any
    ? [$PathValue] extends [Rel]
      ? Option.Option<RelativeTo<$PathValue>>
      : RelativeTo<$PathValue>
    : never
} = Fn.dual(2, (path: Any | string, base: Dir | string): Rel | Option.Option<Rel> => {
  const pathValue = typeof path === 'string' ? S.decodeSync(Any)(path) : path
  const baseValue: Dir = typeof base === 'string' ? (S.decodeSync(Dir)(base) as any) : base

  if (baseValue._tag === 'RelDir') return relativeToRel(pathValue as any, baseValue)
  return relativeToAbs(pathValue as any, baseValue)
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

import { Array, Function as Fn, Option } from 'effect'
import { commonSegmentPrefix } from '../core/segments.js'
import type { Abs } from '../models/Abs.js'
import { AbsDir } from '../models/AbsDir.js'
import { AbsFile } from '../models/AbsFile.js'
import { RelDir } from '../models/RelDir.js'
import type { Rel } from '../models/Rel.js'
import { RelFile } from '../models/RelFile.js'

/** Type-level {@link relativeTo}: maps a path variant to its relative counterpart. */
export type RelativeTo<A extends Abs | Rel> = A extends AbsFile
  ? RelFile
  : A extends RelFile
    ? RelFile
    : A extends AbsDir
      ? RelDir
      : A extends RelDir
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
 * Dual: `relativeTo(path, base)` or `relativeTo(base)` for piping.
 *
 * @example
 * ```ts
 * relativeTo(AbsFile '/home/user/src/index.ts', AbsDir '/home/user') // ./src/index.ts
 * pipe(absFile, relativeTo(base))                                    // same, data-last
 * ```
 */
export const relativeTo: {
  <A extends Abs>(abs: A, base: AbsDir): RelativeTo<A>
  <R extends Rel>(rel: R, base: RelDir): Option.Option<RelativeTo<R>>
  (base: AbsDir): <A extends Abs>(abs: A) => RelativeTo<A>
  (base: RelDir): <R extends Rel>(rel: R) => Option.Option<RelativeTo<R>>
} = Fn.dual(2, (path: Abs | Rel, base: AbsDir | RelDir): Rel | Option.Option<Rel> => {
  if (base._tag === 'RelDir') return relativeToRel(path as Rel, base)
  return relativeToAbs(path as Abs, base)
})

const makeRel = (path: Abs | Rel, ascent: number, segments: readonly string[]): Rel =>
  path._tag === 'AbsFile' || path._tag === 'RelFile'
    ? RelFile.make({ ascent, segments, fileName: path.fileName })
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

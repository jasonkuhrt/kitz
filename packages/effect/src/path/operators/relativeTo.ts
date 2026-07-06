import { Array, Function as Fn } from 'effect'
import { commonSegmentPrefix } from '../core/segments.js'
import type { Abs } from '../models/Abs.js'
import { AbsDir } from '../models/AbsDir.js'
import { AbsFile } from '../models/AbsFile.js'
import { RelDir } from '../models/RelDir.js'
import type { Rel } from '../models/Rel.js'
import { RelFile } from '../models/RelFile.js'

/** Type-level {@link relativeTo}: maps an absolute variant to its relative counterpart. */
export type RelativeTo<A extends Abs> = A extends AbsFile
  ? RelFile
  : A extends AbsDir
    ? RelDir
    : Rel

/**
 * Express an absolute path relative to `base`, walking up out of `base` with
 * `..` for the segments they don't share — the inverse of {@link join}
 * (`join(base, relativeTo(abs, base)) === abs`). Dual: `relativeTo(abs, base)`
 * or `relativeTo(base)` for piping.
 *
 * @example
 * ```ts
 * relativeTo(AbsFile '/home/user/src/index.ts', AbsDir '/home/user') // ./src/index.ts
 * pipe(absFile, relativeTo(base))                                    // same, data-last
 * ```
 */
export const relativeTo: {
  <A extends Abs>(abs: A, base: AbsDir): RelativeTo<A>
  (base: AbsDir): <A extends Abs>(abs: A) => RelativeTo<A>
} = Fn.dual(2, (abs: Abs, base: AbsDir): Rel => {
  const shared = commonSegmentPrefix(abs.segments, base.segments).length
  const back = base.segments.length - shared
  const segments = Array.drop(abs.segments, shared)
  return abs._tag === 'AbsFile'
    ? RelFile.make({ back, segments, fileName: abs.fileName })
    : RelDir.make({ back, segments })
})

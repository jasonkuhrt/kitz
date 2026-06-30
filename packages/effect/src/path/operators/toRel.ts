import { Function as Fn } from 'effect'
import { Abs } from '../models/Abs.js'
import { AbsDir } from '../models/AbsDir.js'
import { AbsFile } from '../models/AbsFile.js'
import { Rel } from '../models/Rel.js'
import { RelDir } from '../models/RelDir.js'
import { RelFile } from '../models/RelFile.js'

/** Type-level {@link toRel}: maps an absolute variant to its relative counterpart. */
export type ToRel<A extends Abs> = A extends AbsFile ? RelFile : A extends AbsDir ? RelDir : Rel

/**
 * Convert an absolute path to one relative to `base`, walking up out of `base`
 * with `..` for the segments they don't share.
 *
 * Dual: data-first `toRel(abs, base)` or data-last `toRel(base)` for piping.
 *
 * @example
 * ```ts
 * toRel(AbsFile '/home/user/src/index.ts', AbsDir '/home/user') // ./src/index.ts
 * pipe(absFile, toRel(base))                                    // same, data-last
 * ```
 */
export const toRel: {
  <A extends Abs>(abs: A, base: AbsDir): ToRel<A>
  (base: AbsDir): <A extends Abs>(abs: A) => ToRel<A>
} = Fn.dual(2, (abs: Abs, base: AbsDir): Rel => {
  let shared = 0
  while (
    shared < abs.segments.length &&
    shared < base.segments.length &&
    abs.segments[shared] === base.segments[shared]
  ) {
    shared++
  }
  const back = base.segments.length - shared
  const segments = abs.segments.slice(shared)
  return 'fileName' in abs
    ? RelFile.make({ back, segments, fileName: abs.fileName })
    : RelDir.make({ back, segments })
})

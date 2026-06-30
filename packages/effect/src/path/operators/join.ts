import { Function as Fn, Match } from 'effect'
import { AbsDir } from '../models/AbsDir.js'
import { AbsFile } from '../models/AbsFile.js'
import { Dir } from '../models/Dir.js'
import { Path } from '../models/Path.js'
import { Rel } from '../models/Rel.js'
import { RelDir } from '../models/RelDir.js'
import { RelFile } from '../models/RelFile.js'

/**
 * Type-level {@link join}: the result keeps the base's absoluteness and the
 * relative path's file/dir nature.
 */
export type Join<Base extends Dir, P extends Rel> = Base extends AbsDir
  ? P extends RelFile
    ? AbsFile
    : P extends RelDir
      ? AbsDir
      : never
  : Base extends RelDir
    ? P extends RelFile
      ? RelFile
      : P extends RelDir
        ? RelDir
        : never
    : never

/**
 * Join a relative path onto a base directory.
 *
 * Leading parent-traversal (`..`) steps in `rel` consume trailing segments of
 * `dir`; any that remain are dropped for an absolute base (can't escape root) or
 * folded into the result's `back` for a relative base. The result keeps `dir`'s
 * absoluteness and `rel`'s file/dir nature.
 *
 * Dual: data-first `join(dir, rel)` or data-last `join(rel)` for piping dirs.
 *
 * @example
 * ```ts
 * join(dir, rel)         // AbsFile /home/user/src/index.ts
 * pipe(dir, join(rel))   // same, data-last
 * ```
 */
export const join: {
  <Base extends Dir, P extends Rel>(dir: Base, rel: P): Join<Base, P>
  <P extends Rel>(rel: P): <Base extends Dir>(dir: Base) => Join<Base, P>
} = Fn.dual(2, (dir: Dir, rel: Rel): Path => {
  const baseSegments = [...dir.segments]
  let remainingBack = rel.back
  while (remainingBack > 0 && baseSegments.length > 0) {
    baseSegments.pop()
    remainingBack--
  }
  const segments = [...baseSegments, ...rel.segments]
  const fileName = 'fileName' in rel ? rel.fileName : null

  return Match.value(dir).pipe(
    Match.tagsExhaustive({
      AbsDir: () =>
        fileName !== null ? AbsFile.make({ segments, fileName }) : AbsDir.make({ segments }),
      RelDir: (relDir) => {
        const back = relDir.back + remainingBack
        return fileName !== null
          ? RelFile.make({ back, segments, fileName })
          : RelDir.make({ back, segments })
      },
    }),
  )
})

import { Match } from 'effect'
import { Abs } from '../models/Abs.js'
import { AbsDir } from '../models/AbsDir.js'
import { AbsFile } from '../models/AbsFile.js'
import { Rel } from '../models/Rel.js'
import { RelDir } from '../models/RelDir.js'
import { RelFile } from '../models/RelFile.js'

/** Type-level {@link toAbs}: maps a relative variant to its absolute counterpart. */
export type toAbs<R extends Rel> = R extends RelFile ? AbsFile : R extends RelDir ? AbsDir : Abs

/**
 * Re-anchor a relative path to root, dropping any `back` traversal
 * (`./src/index.ts` → `/src/index.ts`). To mount a relative path onto a specific
 * base directory instead, use {@link join} — `join(base, rel)`.
 *
 * @example
 * ```ts
 * toAbs(relFile) // ./src/index.ts → /src/index.ts
 * ```
 */
export const toAbs = <R extends Rel>(rel: R): toAbs<R> => {
  const r: Rel = rel
  return Match.value(r).pipe(
    Match.tagsExhaustive({
      RelFile: (file) => AbsFile.make({ segments: file.segments, fileName: file.fileName }),
      RelDir: (dir) => AbsDir.make({ segments: dir.segments }),
    }),
  ) as toAbs<R>
}

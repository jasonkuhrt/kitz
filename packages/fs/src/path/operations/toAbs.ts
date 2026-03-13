/* oxlint-disable typescript-eslint(no-unnecessary-type-assertion) -- branded conditional path return types require explicit assertions; oxlint misidentifies them as redundant. */
import { Match } from 'effect'
import type { $Abs } from '../$Abs/_.js'
import type { $Rel } from '../$Rel/_.js'
import { AbsDir } from '../AbsDir/_.js'
import { AbsFile } from '../AbsFile/_.js'
import { RelDir } from '../RelDir/_.js'
import { RelFile } from '../RelFile/_.js'
import { join } from './join.js'

/**
 * Type-level toAbs operation.
 * Maps relative location types to their absolute counterparts.
 */
export type toAbs<R extends $Rel> = R extends RelFile ? AbsFile : R extends RelDir ? AbsDir : $Abs

/**
 * Convert a relative location to an absolute location.
 *
 * @param rel - The relative location to convert
 * @param base - Optional base directory to resolve against. If not provided, simply converts ./path to /path
 * @returns An absolute location
 *
 * @example
 * ```ts
 * const relFile = Path.RelFile.make({
 *   segments: ['src'],
 *   fileName: { stem: 'index', extension: '.ts' }
 * })
 * const absFile = toAbs(relFile) // /src/index.ts (just re-tags)
 *
 * const base = Path.AbsDir.make({ segments: ['home', 'user'] })
 * const absFile2 = toAbs(relFile, base) // /home/user/src/index.ts (resolves against base)
 * ```
 */
export const toAbs = <$rel extends $Rel, $base extends AbsDir | undefined = undefined>(
  rel: $rel,
  base?: $base,
): toAbs<$rel> => {
  if (base) {
    // Use join to combine base with relative location
    return join(base, rel) as any
  }

  // No base: just convert relative to absolute by re-tagging
  // This essentially changes ./path to /path
  return Match.value(rel as $Rel).pipe(
    Match.tagsExhaustive({
      FsPathRelFile: (file) =>
        AbsFile.make({
          segments: file.segments,
          fileName: file.fileName,
        }),
      FsPathRelDir: (dir) =>
        AbsDir.make({
          segments: dir.segments,
        }),
    }),
  ) as any
}

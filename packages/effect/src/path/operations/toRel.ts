/* oxlint-disable typescript-eslint(no-unnecessary-type-assertion) -- branded conditional path return types require explicit assertions; oxlint misidentifies them as redundant. */
import type { $Abs } from '../$Abs/_.js'
import type { $Rel } from '../$Rel/_.js'
import { AbsDir } from '../AbsDir/_.js'
import { AbsFile } from '../AbsFile/_.js'
import { RelDir } from '../RelDir/_.js'
import { RelFile } from '../RelFile/_.js'

/**
 * Type-level toRel operation.
 * Maps absolute location types to their relative counterparts.
 */
export type toRel<A extends $Abs> = A extends AbsFile ? RelFile : A extends AbsDir ? RelDir : $Rel

/**
 * Convert an absolute location to a relative location.
 *
 * @param abs - The absolute location to convert
 * @param base - The base directory to make the path relative to
 * @returns A relative location
 *
 * @example
 * ```ts
 * const absFile = Path.AbsFile.make({
 *   segments: ['home', 'user', 'src'],
 *   fileName: { stem: 'index', extension: '.ts' }
 * })
 * const base = Path.AbsDir.make({ segments: ['home', 'user'] })
 * const relFile = toRel(absFile, base) // ./src/index.ts
 * ```
 */
export const toRel = <$abs extends $Abs, $base extends AbsDir>(
  abs: $abs,
  base: $base,
): toRel<$abs> => {
  let sharedLength = 0
  while (
    sharedLength < abs.segments.length &&
    sharedLength < base.segments.length &&
    abs.segments[sharedLength] === base.segments[sharedLength]
  ) {
    sharedLength++
  }

  const back = base.segments.length - sharedLength
  const segments = abs.segments.slice(sharedLength)

  return (
    'fileName' in abs
      ? RelFile.make({
          back,
          segments,
          fileName: abs.fileName,
        })
      : RelDir.make({
          back,
          segments,
        })
  ) as any
}

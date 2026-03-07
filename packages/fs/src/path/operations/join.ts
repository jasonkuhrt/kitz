import { Match } from 'effect'
import type { $Dir } from '../$Dir/_.js'
import type { $Rel } from '../$Rel/_.js'
import { AbsDir } from '../AbsDir/_.js'
import { AbsFile } from '../AbsFile/_.js'
import { RelDir } from '../RelDir/_.js'
import { RelFile } from '../RelFile/_.js'

/**
 * Type-level join operation.
 * Maps base and path types to their result type.
 */
export type join<Base extends $Dir, Path extends $Rel> = Base extends AbsDir
  ? Path extends RelFile
    ? AbsFile
    : Path extends RelDir
      ? AbsDir
      : never
  : Base extends RelDir
    ? Path extends RelFile
      ? RelFile
      : Path extends RelDir
        ? RelDir
        : never
    : never

/**
 * Join path segments into a file location.
 * Type-safe conditional return type ensures only valid combinations.
 *
 * When joining with a relative path that has back references (..):
 * - The back references consume segments from the base directory
 * - Any remaining back references are propagated to the result (for relative bases)
 * - For absolute bases, back references that exceed the root are silently dropped
 *
 * @param dir - The base directory (absolute or relative)
 * @param rel - The relative path to join (file or directory)
 * @returns A path with the same absoluteness as dir and the same file/dir nature as rel
 *
 * @example
 * ```ts
 * const absDir = Path.AbsDir.make({ segments: ['home', 'user'] })
 * const relFile = Path.RelFile.make({
 *   segments: ['src'],
 *   fileName: { stem: 'index', extension: '.ts' }
 * })
 * const result = join(absDir, relFile)
 * // AbsFile with segments: ['home', 'user', 'src'], fileName: 'index.ts'
 * ```
 */
export const join = <$dir extends $Dir, $rel extends $Rel>(
  dir: $dir,
  rel: $rel,
): join<$dir, $rel> => {
  // Start with base directory segments
  let baseSegments = [...dir.segments]
  let remainingBack = rel.back

  // Apply back references by popping segments from base
  while (remainingBack > 0 && baseSegments.length > 0) {
    baseSegments.pop()
    remainingBack--
  }

  // Combine remaining base segments with rel segments
  // Note: rel.segments is already normalized (no '..' in it)
  const segments = [...baseSegments, ...rel.segments]
  const fileName = 'fileName' in rel ? rel.fileName : null

  // The result keeps the absolute/relative nature of dir and file/dir nature of rel
  return Match.value(dir as $Dir).pipe(
    Match.tagsExhaustive({
      FsPathAbsDir: () => {
        // For absolute paths, remainingBack is discarded (can't go above root)
        if (fileName !== null) {
          return AbsFile.make({ segments, fileName })
        } else {
          return AbsDir.make({ segments })
        }
      },
      FsPathRelDir: (relDir) => {
        // For relative paths, combine the base's back with any remaining back
        const newBack = relDir.back + remainingBack
        if (fileName !== null) {
          return RelFile.make({ back: newBack, segments, fileName })
        } else {
          return RelDir.make({ back: newBack, segments })
        }
      },
    }),
  ) as any
}

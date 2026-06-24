/* oxlint-disable typescript-eslint(no-unnecessary-type-assertion) -- branded conditional path return types require explicit assertions; oxlint misidentifies them as redundant. */
import { Match } from 'effect'
import type { Dir } from '../models/Dir.js'
import type { Rel } from '../models/Rel.js'
import type { Segment } from '../models/segment/Segment.js'
import { AbsDir } from '../models/AbsDir.js'
import { AbsFile } from '../models/AbsFile.js'
import { RelDir } from '../models/RelDir.js'
import { RelFile } from '../models/RelFile.js'

/**
 * Type-level join operation.
 * Maps base and path types to their result type.
 */
export type join<Base extends Dir, Path extends Rel> = Base extends AbsDir
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
export const join = <$dir extends Dir, $rel extends Rel>(
  dir: $dir,
  rel: $rel,
): join<$dir, $rel> => {
  // rel.segments carries its own leading `..` (Up) steps, so resolve them against the
  // base's trailing named segments: an Up cancels a preceding Name, otherwise it survives
  // (propagating above the base).
  const combined: Segment[] = [...dir.segments]
  for (const segment of rel.segments) {
    const last = combined.at(-1)
    if (segment._tag === 'Up' && last !== undefined && last._tag === 'Name') {
      combined.pop()
    } else {
      combined.push(segment)
    }
  }
  const fileName = 'fileName' in rel ? rel.fileName : null

  // The result keeps the absolute/relative nature of dir and file/dir nature of rel
  return Match.value(dir as Dir).pipe(
    Match.tagsExhaustive({
      // Absolute base: a `..` that couldn't cancel tried to climb above root — drop it.
      AbsDir: () => {
        const segments = combined.filter((segment) => segment._tag !== 'Up')
        return fileName !== null ? AbsFile.make({ segments, fileName }) : AbsDir.make({ segments })
      },
      // Relative base: surviving leading `..` steps are part of the result.
      RelDir: () =>
        fileName !== null
          ? RelFile.make({ segments: combined, fileName })
          : RelDir.make({ segments: combined }),
    }),
  ) as any
}

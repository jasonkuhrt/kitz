import { Match } from 'effect'
import type { Path } from '../_.js'
import { AbsDir } from '../models/AbsDir.js'
import { AbsFile } from '../models/AbsFile.js'
import type { FileName } from '../models/FileName.js'
import { Rel } from '../models/Rel.js'
import { RelDir } from '../models/RelDir.js'
import { RelFile } from '../models/RelFile.js'
import type { Segment } from '../models/Segment.js'

/**
 * Internal unsafe setter for Path operations.
 * Updates segments, back, and/or fileName properties while preserving the path's type structure.
 *
 * @internal
 */
export const set = (
  path: Path,
  options: { segments?: readonly Segment[]; fileName?: FileName | null; back?: number },
): Path => {
  const segments = options.segments ?? path.segments
  const fileName =
    options.fileName !== undefined
      ? options.fileName
      : 'fileName' in path
        ? path.fileName
        : undefined
  const back = options.back ?? (Rel.is(path) ? path.back : 0)

  return Match.value(path).pipe(
    Match.tagsExhaustive({
      FsPathAbsFile: () =>
        AbsFile.make({
          segments,
          fileName: fileName!,
        }),
      FsPathRelFile: () =>
        RelFile.make({
          back,
          segments,
          fileName: fileName!,
        }),
      FsPathAbsDir: () =>
        AbsDir.make({
          segments,
        }),
      FsPathRelDir: () =>
        RelDir.make({
          back,
          segments,
        }),
    }),
  )
}

/**
 * Resolve path segments by collapsing parent references (..)
 * @internal
 */
export const resolveSegments = (segments: readonly Segment[]): Segment[] => {
  const resolved: Segment[] = []

  for (const segment of segments) {
    if (segment._tag === 'Up') {
      // Collapse a parent reference (`..`) against the previous step, if any
      if (resolved.length > 0) {
        resolved.pop()
      }
    } else {
      resolved.push(segment)
    }
  }

  return resolved
}

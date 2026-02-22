import { Match } from 'effect'
import { $Rel } from '../$Rel/_.js'
import type { Path } from '../_.js'
import { AbsDir } from '../AbsDir/_.js'
import { AbsFile } from '../AbsFile/_.js'
import { RelDir } from '../RelDir/_.js'
import { RelFile } from '../RelFile/_.js'
import type { FileName } from '../types/fileName.js'

/**
 * Internal unsafe setter for Path operations.
 * Updates segments, back, and/or fileName properties while preserving the path's type structure.
 *
 * @internal
 */
export const set = (
  path: Path,
  options: { segments?: readonly string[]; fileName?: FileName | null; back?: number },
): Path => {
  const segments = options.segments ?? path.segments
  const fileName = options.fileName !== undefined ? options.fileName : ('fileName' in path ? path.fileName : undefined)
  const back = options.back ?? ($Rel.is(path) ? path.back : 0)

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
export const resolveSegments = (segments: readonly string[]): string[] => {
  const resolved: string[] = []

  for (const segment of segments) {
    if (segment === '..') {
      // Remove the last segment if it exists and we're not at root
      if (resolved.length > 0) {
        resolved.pop()
      }
    } else if (segment !== '.' && segment !== '') {
      // Skip current directory references and empty segments
      resolved.push(segment)
    }
  }

  return resolved
}

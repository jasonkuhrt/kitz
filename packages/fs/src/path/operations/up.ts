import { Match } from 'effect'
import type { Path } from '../_.js'
import { AbsDir } from '../AbsDir/_.js'
import { AbsFile } from '../AbsFile/_.js'
import type { Guard, Input, normalize } from '../inputs.js'
import { normalizeDynamic } from '../inputs.js'
import { RelDir } from '../RelDir/_.js'
import { RelFile } from '../RelFile/_.js'
import { Schema } from '../Schema.js'

const normalizer = normalizeDynamic(Schema)

/**
 * Move up one level in the path hierarchy.
 *
 * For absolute paths: removes the last segment (stops at root).
 * For relative paths: removes the last segment, or increments back count if no segments.
 *
 * @param $path - The path to move up from
 * @returns A new path one level up
 *
 * @example
 * ```ts
 * const absPath = Path.Abs.make({ segments: ['home', 'user', 'docs'] })
 * const parent = up(absPath) // segments: ['home', 'user']
 *
 * const relPath = Path.Rel.make({ segments: ['src', 'lib'] })
 * const parent2 = up(relPath) // back: 0, segments: ['src']
 *
 * const relCurrent = Path.Rel.make({ segments: [] }) // ./
 * const parent3 = up(relCurrent) // back: 1, segments: [] (becomes ../)
 *
 * const rootPath = Path.Abs.make({ segments: [] })
 * const stillRoot = up(rootPath) // segments: [] (stays at root)
 * ```
 */
export function up<$input extends Input>($input: $input): normalize<$input> {
  const $path = normalizer($input) as Path

  return Match.value($path).pipe(
    Match.tagsExhaustive({
      FsPathAbsFile: (file) =>
        AbsFile.make({
          segments: file.segments.slice(0, -1),
          fileName: file.fileName,
        }),
      FsPathAbsDir: (dir) =>
        AbsDir.make({
          segments: dir.segments.slice(0, -1),
        }),
      FsPathRelFile: (file) => {
        if (file.segments.length > 0) {
          // Has segments: pop one
          return RelFile.make({
            back: file.back,
            segments: file.segments.slice(0, -1),
            fileName: file.fileName,
          })
        }
        // No segments: increment back
        return RelFile.make({
          back: file.back + 1,
          segments: [],
          fileName: file.fileName,
        })
      },
      FsPathRelDir: (dir) => {
        if (dir.segments.length > 0) {
          // Has segments: pop one
          return RelDir.make({
            back: dir.back,
            segments: dir.segments.slice(0, -1),
          })
        }
        // No segments: increment back
        return RelDir.make({
          back: dir.back + 1,
          segments: [],
        })
      },
    }),
  ) as any
}

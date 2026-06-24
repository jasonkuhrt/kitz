import { Match } from 'effect'
import type { Path } from '../_.js'
import type { Input, normalize } from '../inputs.js'
import { normalizeDynamic } from '../inputs.js'
import { AbsDir } from '../models/AbsDir.js'
import { AbsFile } from '../models/AbsFile.js'
import { Path as Schema } from '../models/Path.js'
import { RelDir } from '../models/RelDir.js'
import { RelFile } from '../models/RelFile.js'

const normalizer = normalizeDynamic(Schema)

/**
 * Move one level up the path hierarchy, **preserving the path's kind**.
 *
 * The last path SEGMENT is removed. A filename is not a segment, so a FILE keeps its
 * name and moves up into its grandparent directory; a DIRECTORY becomes its parent:
 * - `up('/a/b/c.txt')` → `'/a/c.txt'`  — still a file, moved up one directory
 * - `up('/a/b/')`      → `'/a/'`        — parent directory
 *
 * Absolute paths stop at root (`/`). A relative path with no segments left increments
 * its parent-traversal `back` count instead (`./` → `../`, `../` → `../../`).
 *
 * @param $input - The path to move up from
 * @returns A new path of the SAME kind, one level up
 *
 * @example
 * ```ts
 * up(Path.AbsFile.fromString('/a/b/c.txt')) // AbsFile '/a/c.txt' (file kept, up one dir)
 * up(Path.AbsDir.fromString('/a/b/'))       // AbsDir  '/a/'      (parent directory)
 * up(Path.RelDir.fromString('./'))          // RelDir  '../'      (no segments → back++)
 * ```
 */
export function up<$input extends Input>($input: $input): normalize<$input> {
  const $path = normalizer($input) as Path

  return Match.value($path).pipe(
    Match.tagsExhaustive({
      AbsFile: (file) =>
        AbsFile.make({
          segments: file.segments.slice(0, -1),
          fileName: file.fileName,
        }),
      AbsDir: (dir) =>
        AbsDir.make({
          segments: dir.segments.slice(0, -1),
        }),
      RelFile: (file) => {
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
      RelDir: (dir) => {
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
  ) as normalize<$input>
}

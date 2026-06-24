import { Match } from 'effect'
import type { Path } from '../_.js'
import type { Input, normalize } from '../inputs.js'
import { normalizeDynamic } from '../inputs.js'
import { AbsDir } from '../models/AbsDir.js'
import { AbsFile } from '../models/AbsFile.js'
import { Path as Schema } from '../models/Path.js'
import { RelDir } from '../models/RelDir.js'
import { RelFile } from '../models/RelFile.js'
import { Segment } from '../models/Segment.js'

const normalizer = normalizeDynamic(Schema)

/** A parent-traversal (`..`) step, appended when no named segment remains to drop. */
const parentStep = Segment.decodeSync('..')

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
        const last = file.segments.at(-1)
        // A trailing named segment can be dropped (back out of it); otherwise there is
        // nothing left to drop, so go one further up by appending a `..` step.
        return last !== undefined && last._tag === 'Name'
          ? RelFile.make({ segments: file.segments.slice(0, -1), fileName: file.fileName })
          : RelFile.make({ segments: [...file.segments, parentStep], fileName: file.fileName })
      },
      RelDir: (dir) => {
        const last = dir.segments.at(-1)
        return last !== undefined && last._tag === 'Name'
          ? RelDir.make({ segments: dir.segments.slice(0, -1) })
          : RelDir.make({ segments: [...dir.segments, parentStep] })
      },
    }),
  ) as normalize<$input>
}

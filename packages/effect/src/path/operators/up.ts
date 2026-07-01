import { Array, Match } from 'effect'
import { AbsDir } from '../models/AbsDir.js'
import { AbsFile } from '../models/AbsFile.js'
import { Path } from '../models/Path.js'
import { RelDir } from '../models/RelDir.js'
import { RelFile } from '../models/RelFile.js'

/**
 * Move a path up one directory level, preserving its variant.
 *
 * Directories drop their last segment (absolute paths stop at root). Files keep
 * their filename and drop their last directory segment, so the same file is
 * re-parented one level up (`/a/b/c.txt` → `/a/c.txt`). A relative path with no
 * segments grows its `back` count instead (`./` → `../`).
 *
 * @example
 * ```ts
 * up(AbsDir '/home/user/docs')  // AbsDir /home/user/
 * up(RelDir './')               // RelDir ../
 * ```
 */
export const up = <P extends Path>(path: P): P => {
  const p: Path = path
  return Match.value(p).pipe(
    Match.tagsExhaustive({
      AbsFile: (file) =>
        AbsFile.make({ segments: Array.dropRight(file.segments, 1), fileName: file.fileName }),
      AbsDir: (dir) => AbsDir.make({ segments: Array.dropRight(dir.segments, 1) }),
      RelFile: (file) =>
        file.segments.length > 0
          ? RelFile.make({
              back: file.back,
              segments: Array.dropRight(file.segments, 1),
              fileName: file.fileName,
            })
          : RelFile.make({ back: file.back + 1, segments: [], fileName: file.fileName }),
      RelDir: (dir) =>
        dir.segments.length > 0
          ? RelDir.make({ back: dir.back, segments: Array.dropRight(dir.segments, 1) })
          : RelDir.make({ back: dir.back + 1, segments: [] }),
    }),
  ) as P
}

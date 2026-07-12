import type { AbsDir } from '../models/AbsDir.js'
import type { AbsFile } from '../models/AbsFile.js'
import type { Any } from '../models/Any.js'
import type { Dir } from '../models/Dir.js'
import type { RelDir } from '../models/RelDir.js'
import type { RelFile } from '../models/RelFile.js'

/** The containing or parent directory returned for a path variant. */
export type DirOf<$P extends Any> = $P extends AbsFile
  ? AbsDir
  : $P extends RelFile
    ? RelDir
    : $P extends AbsDir
      ? AbsDir
      : $P extends RelDir
        ? RelDir
        : never

/**
 * Return a file's containing directory or a directory's navigated parent.
 * The return distributes over path variants and preserves their group.
 */
export const dir = <$P extends Any>(path: $P): DirOf<$P> => {
  const value: Any = path
  const result: Dir =
    value._tag === 'AbsFile' || value._tag === 'RelFile' ? value.dir : value.parent
  return result as any
}

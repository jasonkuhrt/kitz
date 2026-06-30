import { Match } from 'effect'
import { AbsDir } from '../models/AbsDir.js'
import { AbsFile } from '../models/AbsFile.js'
import { Dir } from '../models/Dir.js'
import { File } from '../models/File.js'
import { RelDir } from '../models/RelDir.js'
import { RelFile } from '../models/RelFile.js'

/** Type-level {@link toDir}: maps a file variant to the directory that contains it. */
export type ToDir<F extends File> = F extends AbsFile ? AbsDir : F extends RelFile ? RelDir : Dir

/**
 * Drop the filename from a file path, yielding its containing directory.
 *
 * @example
 * ```ts
 * toDir(AbsFile '/home/user/file.txt') // AbsDir /home/user/
 * ```
 */
export const toDir = <F extends File>(file: F): ToDir<F> => {
  const f: File = file
  return Match.value(f).pipe(
    Match.tagsExhaustive({
      AbsFile: (file) => AbsDir.make({ segments: file.segments }),
      RelFile: (file) => RelDir.make({ back: file.back, segments: file.segments }),
    }),
  ) as ToDir<F>
}

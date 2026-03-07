import { Match } from 'effect'
import type { $Dir } from '../$Dir/_.js'
import type { $File } from '../$File/_.js'
import { AbsDir } from '../AbsDir/_.js'
import { AbsFile } from '../AbsFile/_.js'
import { RelDir } from '../RelDir/_.js'
import { RelFile } from '../RelFile/_.js'

/**
 * Type-level toDir operation.
 */
export type toDir<F extends $File> = F extends AbsFile ? AbsDir : F extends RelFile ? RelDir : $Dir

/**
 * Drop the file from a file location, returning just the parent directory location.
 *
 * @param file - The file location
 * @returns The parent directory location
 *
 * @example
 * ```ts
 * const file = Path.AbsFile.make({
 *   segments: ['home', 'user'],
 *   fileName: { stem: 'file', extension: '.txt' }
 * })
 * const dir = toDir(file) // AbsDir with segments: ['home', 'user']
 * ```
 */
export const toDir = <$file extends $File>(file: $file): toDir<$file> => {
  // Use the file's existing segments which represent the parent directory
  const segments = [...file.segments]
  // Create the appropriate directory type based on whether file is absolute or relative
  return Match.value(file as $File).pipe(
    Match.tagsExhaustive({
      FsPathAbsFile: () => AbsDir.make({ segments }),
      FsPathRelFile: (file) => RelDir.make({ back: file.back, segments }),
    }),
  ) as any
}

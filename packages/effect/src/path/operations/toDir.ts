/* oxlint-disable typescript-eslint(no-unnecessary-type-assertion) -- branded conditional path return types require explicit assertions; oxlint misidentifies them as redundant. */
import { Match } from 'effect'
import type { Dir } from '../models/Dir.js'
import type { File } from '../models/File.js'
import { AbsDir } from '../models/AbsDir.js'
import { AbsFile } from '../models/AbsFile.js'
import { RelDir } from '../models/RelDir.js'
import { RelFile } from '../models/RelFile.js'

/**
 * Type-level toDir operation.
 */
export type toDir<F extends File> = F extends AbsFile ? AbsDir : F extends RelFile ? RelDir : Dir

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
export const toDir = <$file extends File>(file: $file): toDir<$file> => {
  // Use the file's existing segments which represent the parent directory
  const segments = [...file.segments]
  // Create the appropriate directory type based on whether file is absolute or relative
  return Match.value(file as File).pipe(
    Match.tagsExhaustive({
      AbsFile: () => AbsDir.make({ segments }),
      // `segments` already carries any leading `..` (Up) steps; `back` is derived.
      RelFile: () => RelDir.make({ segments }),
    }),
  ) as any
}

import { Match } from 'effect'
import type { Path } from '../_.js'
import type { Input } from '../inputs.js'
import { normalizeDynamic } from '../inputs.js'
import { Schema } from '../Schema.js'

const normalizer = normalizeDynamic(Schema)

/**
 * Get the stem (name without extension) of a location.
 *
 * For files: returns the filename without extension.
 * For directories: returns the directory name (same as name()).
 * For root directories: returns an empty string.
 *
 * @param path - The path to get the stem from
 * @returns The stem of the file or directory name
 *
 * @example
 * ```ts
 * stem('/path/to/file.txt') // 'file'
 * stem('/path/to/archive.tar.gz') // 'archive.tar'
 * stem('/path/to/src/') // 'src'
 * stem('./docs/README.md') // 'README'
 * stem('/') // ''
 * ```
 */
export const stem = <$input extends Input>(path: $input): string => {
  const normalized = normalizer(path) as Path
  return Match.value(normalized).pipe(
    Match.tagsExhaustive({
      FsPathAbsFile: (file) => file.fileName.stem,
      FsPathRelFile: (file) => file.fileName.stem,
      FsPathAbsDir: (dir) =>
        dir.segments.length > 0 ? dir.segments[dir.segments.length - 1]! : '',
      FsPathRelDir: (dir) =>
        dir.segments.length > 0 ? dir.segments[dir.segments.length - 1]! : '',
    }),
  )
}

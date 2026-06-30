import { Match } from 'effect'
import type { $File } from '../$File/_.js'
import type { Path } from '../_.js'
import type { Guard, Input } from '../inputs.js'
import { normalizeDynamic } from '../inputs.js'
import { Schema } from '../Schema.js'

const normalizer = normalizeDynamic(Schema)

/**
 * Get the extension of a file location.
 *
 * For files: returns the extension including the leading dot, or null if no extension.
 * For directories: always returns null.
 *
 * @param path - The path to get the extension from
 * @returns The extension with leading dot (e.g., '.txt'), or null for directories and files without extensions
 *
 * @example
 * ```ts
 * extension('/path/to/file.txt') // '.txt'
 * extension('/path/to/archive.tar.gz') // '.gz'
 * extension('/path/to/README') // null
 * extension('/path/to/src/') // null
 * extension('./docs/README.md') // '.md'
 * ```
 */
export function extension<$input extends Input<$File>>($input: $input): string | null
export function extension<$input extends Input>($input: $input): string | null
export function extension<$input extends Input>($input: $input): string | null {
  const path = normalizer($input) as Path
  return Match.value(path).pipe(
    Match.tagsExhaustive({
      FsPathAbsFile: (file) => file.fileName.extension,
      FsPathRelFile: (file) => file.fileName.extension,
      FsPathAbsDir: () => null,
      FsPathRelDir: () => null,
    }),
  )
}

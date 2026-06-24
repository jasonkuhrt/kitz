import type { Path } from '../_.js'
import type { Input } from '../inputs.js'
import { normalizeDynamic } from '../inputs.js'
import { Path as Schema } from '../models/Path.js'

const normalizer = normalizeDynamic(Schema)

/**
 * Get the name (last segment) of a location.
 *
 * For files: returns the filename including extension.
 * For directories: returns the directory name.
 * For root directories: returns an empty string.
 *
 * Prefer using the `.name` getter directly on path instances when available.
 *
 * @param path - The path to get the name from
 * @returns The name of the file or directory
 *
 * @example
 * ```ts
 * name('/path/to/file.txt') // 'file.txt'
 * name('/path/to/src/') // 'src'
 * name('./docs/README.md') // 'README.md'
 * name('/') // ''
 * ```
 */
export const name = <$input extends Input>(path: $input): string => {
  const normalized = normalizer(path) as Path
  return normalized.name
}

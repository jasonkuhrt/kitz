import type { $Abs } from '../$Abs/_.js'
import { toString } from './toString.js'

/**
 * Convert an absolute path (file or dir) to a file:// URL.
 *
 * Uses the standard URL constructor for platform portability (Node, Bun, browsers).
 * Node.js's `pathToFileURL` handles additional cases we don't need since kit paths are Unix-only:
 * Windows backslashes, drive letters, UNC paths, path resolution.
 *
 * @see {@link https://github.com/nodejs/node/blob/v22.x/lib/internal/url.js#L1365-L1400 | Node.js pathToFileURL}
 *
 * @param path - An absolute path (AbsFile or AbsDir)
 * @returns A URL object with file:// protocol
 *
 * @example
 * ```ts
 * const path = Path.AbsFile.fromString('/home/user/file.ts')
 * const url = Path.toFileUrl(path)
 * // url.href === 'file:///home/user/file.ts'
 * ```
 */
export const toFileUrl = (path: $Abs): URL => new URL(`file://${toString(path)}`)

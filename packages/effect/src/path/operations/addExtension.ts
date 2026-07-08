import { Function as Fn, Option } from 'effect'
import { replaceFileName } from '../core/replaceFileName.js'
import type { Extension } from '../models/Extension.js'
import type { File } from '../models/File.js'
import { FileName } from '../models/FileName.js'

/**
 * Append an extension to a file path while preserving its file variant.
 *
 * @example
 * ```ts
 * addExtension(archive, '.gz') // archive.tar -> archive.tar.gz
 * ```
 */
export const addExtension: {
  <F extends File>(file: F, extension: Extension): F
  (extension: Extension): <F extends File>(file: F) => F
} = Fn.dual(
  2,
  (file: File, extension: Extension): File =>
    replaceFileName(file, FileName.make({ stem: file.name, extension: Option.some(extension) })),
)

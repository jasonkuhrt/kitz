import { Function as Fn } from 'effect'
import { replaceFileName } from '../core/replaceFileName.js'
import type { File } from '../models/File.js'
import { FileName } from '../models/FileName.js'

/**
 * Replace a file path's stem while preserving its file variant and current
 * extension. The stem follows the path module's last-dot filename rule.
 *
 * @example
 * ```ts
 * withStem(file, 'README')
 * file.pipe(withStem('README'))
 * ```
 */
export const withStem: {
  <F extends File>(file: F, stem: string): F
  (stem: string): <F extends File>(file: F) => F
} = Fn.dual(
  2,
  (file: File, stem: string): File =>
    replaceFileName(file, FileName.make({ stem, extension: file.extension })),
)

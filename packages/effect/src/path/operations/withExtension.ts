import { Function as Fn, Option } from 'effect'
import { replaceFileName } from '../core/replaceFileName.js'
import type { Extension } from '../models/Extension.js'
import type { File } from '../models/File.js'
import { FileName } from '../models/FileName.js'

const normalizeExtension = (
  extension: Extension | Option.Option<Extension>,
): Option.Option<Extension> => (Option.isOption(extension) ? extension : Option.some(extension))

/**
 * Replace a file path's final extension while preserving its file variant.
 * Passing `Option.none()` removes the final extension segment.
 *
 * @example
 * ```ts
 * withExtension(file, '.json')
 * withExtension(file, Option.none())
 * ```
 */
export const withExtension: {
  <F extends File>(file: F, extension: Extension | Option.Option<Extension>): F
  (extension: Extension | Option.Option<Extension>): <F extends File>(file: F) => F
} = Fn.dual(
  2,
  (file: File, extension: Extension | Option.Option<Extension>): File =>
    replaceFileName(
      file,
      FileName.make({ stem: file.stem, extension: normalizeExtension(extension) }),
    ),
)

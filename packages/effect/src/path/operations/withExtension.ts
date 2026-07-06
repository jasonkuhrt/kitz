import { Function as Fn, Match, Option } from 'effect'
import type { Extension } from '../models/Extension.js'
import type { File } from '../models/File.js'
import { FileName } from '../models/FileName.js'
import * as PathOptic from '../optic.js'

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
} = Fn.dual(2, (file: File, extension: Extension | Option.Option<Extension>): File => {
  const nextExtension = normalizeExtension(extension)
  return Match.value(file).pipe(
    Match.tagsExhaustive({
      AbsFile: (abs) =>
        PathOptic.AbsFile.fileName.replace(
          FileName.make({ stem: abs.stem, extension: nextExtension }),
          abs,
        ),
      RelFile: (rel) =>
        PathOptic.RelFile.fileName.replace(
          FileName.make({ stem: rel.stem, extension: nextExtension }),
          rel,
        ),
    }),
  )
})

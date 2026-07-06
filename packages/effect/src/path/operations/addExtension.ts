import { Function as Fn, Match, Option } from 'effect'
import type { Extension } from '../models/Extension.js'
import type { File } from '../models/File.js'
import { FileName } from '../models/FileName.js'
import * as PathOptic from '../optic.js'

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
    Match.value(file).pipe(
      Match.tagsExhaustive({
        AbsFile: (abs) =>
          PathOptic.AbsFile.fileName.replace(
            FileName.make({ stem: abs.name, extension: Option.some(extension) }),
            abs,
          ),
        RelFile: (rel) =>
          PathOptic.RelFile.fileName.replace(
            FileName.make({ stem: rel.name, extension: Option.some(extension) }),
            rel,
          ),
      }),
    ),
)

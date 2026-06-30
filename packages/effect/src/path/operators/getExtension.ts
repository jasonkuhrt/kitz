import { Match, Option } from 'effect'
import type { Extension } from '../models/Extension.js'
import { Path } from '../models/Path.js'

/**
 * A file's extension (with leading dot) as an {@link Option}, or `None` for a
 * directory or an extension-less file.
 *
 * @example
 * ```ts
 * getExtension(AbsFile '/a/file.txt') // Option.some('.txt')
 * getExtension(AbsFile '/a/README')   // Option.none()
 * getExtension(AbsDir  '/a/src/')     // Option.none()
 * ```
 */
export const getExtension = (path: Path): Option.Option<Extension> =>
  Match.value(path).pipe(
    Match.tagsExhaustive({
      AbsFile: (file) => file.fileName.extension,
      RelFile: (file) => file.fileName.extension,
      AbsDir: () => Option.none(),
      RelDir: () => Option.none(),
    }),
  )

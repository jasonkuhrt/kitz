import { Match, Option } from 'effect'
import { Any } from '../models/Any.js'

/**
 * The stem — a file's name without its extension, or a directory's name. The
 * extension split is on the last dot, so `archive.tar.gz` has stem `archive.tar`.
 *
 * @example
 * ```ts
 * getStem(AbsFile '/a/archive.tar.gz') // 'archive.tar'
 * getStem(AbsDir '/a/src/')            // 'src'
 * ```
 */
export const getStem = (path: Any): string =>
  Match.value(path).pipe(
    Match.tagsExhaustive({
      AbsFile: (file) => file.fileName.stem,
      RelFile: (file) => file.fileName.stem,
      AbsDir: (dir) => Option.getOrElse(dir.name, () => ''),
      RelDir: (dir) => Option.getOrElse(dir.name, () => ''),
    }),
  )

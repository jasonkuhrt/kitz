import { Match, Option } from 'effect'
import type { FileName } from '../models/FileName.js'
import { Any } from '../models/Any.js'

const fileNameToString = (fileName: FileName): string =>
  Option.match(fileName.extension, {
    onNone: () => fileName.stem,
    onSome: (extension) => `${fileName.stem}${extension}`,
  })

/**
 * The last path component as a string — a file's full name (with extension) or a
 * directory's name. Empty string for root / segment-less directories.
 *
 * @example
 * ```ts
 * getName(AbsFile '/a/file.txt') // 'file.txt'
 * getName(AbsDir '/a/src/')      // 'src'
 * ```
 */
export const getName = (path: Any): string =>
  Match.value(path).pipe(
    Match.tagsExhaustive({
      AbsFile: (file) => fileNameToString(file.fileName),
      RelFile: (file) => fileNameToString(file.fileName),
      AbsDir: (dir) => Option.getOrElse(dir.name, () => ''),
      RelDir: (dir) => Option.getOrElse(dir.name, () => ''),
    }),
  )

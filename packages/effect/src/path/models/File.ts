import { Schema as S } from 'effect'
import { withStatics } from '../core/statics.js'
import { AbsFile } from './AbsFile.js'
import { RelFile } from './RelFile.js'

/**
 * `File` — any file path (`AbsFile | RelFile`), as a `string` ⇄ value codec.
 * Carries tagged-union utilities keyed by `_tag`: `cases`, `guards`, `isAnyOf`, `match`.
 */
class File_ extends withStatics(
  S.asClass(
    S.Union([AbsFile, RelFile]).pipe(
      S.toTaggedUnion('_tag'),
      S.overrideToFormatter(() => (path) => path.toString()),
    ),
  ),
) {
  static readonly AbsFile = AbsFile
  static readonly RelFile = RelFile
}

export const File = File_
export type File = typeof File_.Type

import { Schema as S } from 'effect'
import { withStatics } from '../../schema/withStatics.js'
import { withLiteralStatics } from '../core/statics.js'
import { AbsFile } from './AbsFile.js'
import { RelFile } from './RelFile.js'

/**
 * `File` — any file path (`AbsFile | RelFile`), as a `string` ⇄ value codec.
 * Carries tagged-union utilities keyed by `_tag`: `cases`, `guards`, `isAnyOf`, `match`.
 */
const FileTaggedUnion = S.Union([AbsFile, RelFile]).pipe(S.toTaggedUnion('_tag'))

class File_ extends withLiteralStatics(
  withStatics(
    S.asClass(FileTaggedUnion.pipe(S.overrideToFormatter(() => (path) => path.toString()))),
  ),
) {
  static readonly cases = FileTaggedUnion.cases
  static readonly guards = FileTaggedUnion.guards
  static readonly isAnyOf = FileTaggedUnion.isAnyOf
  static readonly match = FileTaggedUnion.match
}

export const File = File_
export type File = typeof File_.Type

import { Schema as S } from 'effect'
import { AbsFile } from './AbsFile.js'
import { RelFile } from './RelFile.js'
import { unionEquivalence } from './_equivalence.js'

/**
 * `File` — any file path (`AbsFile | RelFile`), as a `string` ⇄ value codec.
 */
class File_ extends S.asClass(S.Union([AbsFile, RelFile])) {
  static readonly AbsFile = AbsFile
  static readonly RelFile = RelFile
  static readonly is = S.is(File_)
  static readonly equivalence = unionEquivalence<typeof File_.Type>({
    AbsFile: AbsFile.equivalence,
    RelFile: RelFile.equivalence,
  })
}

export const File = File_
export type File = typeof File_.Type

import { Schema as S } from 'effect'
import { RelDir } from './RelDir.js'
import { RelFile } from './RelFile.js'

/**
 * `Rel` — any relative path (`RelFile | RelDir`), as a `string` ⇄ value codec.
 */
class Rel_ extends S.asClass(S.Union([RelFile, RelDir])) {
  static readonly RelFile = RelFile
  static readonly RelDir = RelDir
}

export const Rel = Rel_
export type Rel = typeof Rel_.Type

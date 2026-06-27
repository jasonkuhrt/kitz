import { Schema as S } from 'effect'
import { AbsDir } from './AbsDir.js'
import { AbsFile } from './AbsFile.js'

/**
 * `Abs` — any absolute path (`AbsFile | AbsDir`), as a `string` ⇄ value codec.
 */
class Abs_ extends S.asClass(S.Union([AbsFile, AbsDir])) {
  static readonly AbsFile = AbsFile
  static readonly AbsDir = AbsDir
}

export const Abs = Abs_
export type Abs = typeof Abs_.Type

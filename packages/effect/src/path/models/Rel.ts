import { Schema as S } from 'effect'
import { withStatics } from '../core/statics.js'
import { RelDir } from './RelDir.js'
import { RelFile } from './RelFile.js'

/**
 * `Rel` — any relative path (`RelFile | RelDir`), as a `string` ⇄ value codec.
 */
class Rel_ extends withStatics(S.asClass(S.Union([RelFile, RelDir]))) {
  static readonly RelFile = RelFile
  static readonly RelDir = RelDir
}

export const Rel = Rel_
export type Rel = typeof Rel_.Type

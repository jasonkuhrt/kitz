import { Schema as S } from 'effect'
import { withStatics } from '../core/statics.js'
import { AbsDir } from './AbsDir.js'
import { RelDir } from './RelDir.js'

/**
 * `Dir` — any directory path (`AbsDir | RelDir`), as a `string` ⇄ value codec.
 */
class Dir_ extends withStatics(S.asClass(S.Union([AbsDir, RelDir]))) {
  static readonly AbsDir = AbsDir
  static readonly RelDir = RelDir
}

export const Dir = Dir_
export type Dir = typeof Dir_.Type

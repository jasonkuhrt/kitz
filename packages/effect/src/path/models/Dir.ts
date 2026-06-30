import { Schema as S } from 'effect'
import { AbsDir } from './AbsDir.js'
import { RelDir } from './RelDir.js'
import { unionEquivalence } from './_equivalence.js'

/**
 * `Dir` — any directory path (`AbsDir | RelDir`), as a `string` ⇄ value codec.
 */
class Dir_ extends S.asClass(S.Union([AbsDir, RelDir])) {
  static readonly AbsDir = AbsDir
  static readonly RelDir = RelDir
  static readonly is = S.is(Dir_)
  static readonly equivalence = unionEquivalence<typeof Dir_.Type>({
    AbsDir: AbsDir.equivalence,
    RelDir: RelDir.equivalence,
  })
}

export const Dir = Dir_
export type Dir = typeof Dir_.Type

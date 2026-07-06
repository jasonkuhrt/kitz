import { Schema as S } from 'effect'
import { withLiteralStatics, withStatics } from '../core/statics.js'
import { AbsDir } from './AbsDir.js'
import { RelDir } from './RelDir.js'

/**
 * `Dir` — any directory path (`AbsDir | RelDir`), as a `string` ⇄ value codec.
 * Carries tagged-union utilities keyed by `_tag`: `cases`, `guards`, `isAnyOf`, `match`.
 */
class Dir_ extends withLiteralStatics(
  withStatics(
    S.asClass(
      S.Union([AbsDir, RelDir]).pipe(
        S.overrideToFormatter(() => (path) => path.toString()),
        S.toTaggedUnion('_tag'),
      ),
    ),
  ),
) {
  static readonly AbsDir = AbsDir
  static readonly RelDir = RelDir
}

export const Dir = Dir_
export type Dir = typeof Dir_.Type

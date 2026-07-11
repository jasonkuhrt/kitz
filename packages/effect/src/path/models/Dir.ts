import { Schema as S } from 'effect'
import { withStatics } from '../../schema/withStatics.js'
import { withLiteralStatics } from '../core/statics.js'
import { AbsDir } from './AbsDir.js'
import { RelDir } from './RelDir.js'

/**
 * `Dir` — any directory path (`AbsDir | RelDir`), as a `string` ⇄ value codec.
 * Carries tagged-union utilities keyed by `_tag`: `cases`, `guards`, `isAnyOf`, `match`.
 */
const DirTaggedUnion = S.Union([AbsDir, RelDir]).pipe(S.toTaggedUnion('_tag'))

class Dir_ extends withLiteralStatics(
  withStatics(
    S.asClass(DirTaggedUnion.pipe(S.overrideToFormatter(() => (path) => path.toString()))),
  ),
) {
  static readonly cases = DirTaggedUnion.cases
  static readonly guards = DirTaggedUnion.guards
  static readonly isAnyOf = DirTaggedUnion.isAnyOf
  static readonly match = DirTaggedUnion.match
}

export const Dir = Dir_
export type Dir = typeof Dir_.Type

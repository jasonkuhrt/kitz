import { Schema as S } from 'effect'
import { withLiteralStatics, withStatics } from '../core/statics.js'
import { RelDir } from './RelDir.js'
import { RelFile } from './RelFile.js'

/**
 * `Rel` — any relative path (`RelFile | RelDir`), as a `string` ⇄ value codec.
 * Carries tagged-union utilities keyed by `_tag`: `cases`, `guards`, `isAnyOf`, `match`.
 */
const RelTaggedUnion = S.Union([RelFile, RelDir]).pipe(S.toTaggedUnion('_tag'))

class Rel_ extends withLiteralStatics(
  withStatics(
    S.asClass(RelTaggedUnion.pipe(S.overrideToFormatter(() => (path) => path.toString()))),
  ),
) {
  static readonly RelFile = RelFile
  static readonly RelDir = RelDir
  static readonly cases = RelTaggedUnion.cases
  static readonly guards = RelTaggedUnion.guards
  static readonly isAnyOf = RelTaggedUnion.isAnyOf
  static readonly match = RelTaggedUnion.match
}

export const Rel = Rel_
export type Rel = typeof Rel_.Type

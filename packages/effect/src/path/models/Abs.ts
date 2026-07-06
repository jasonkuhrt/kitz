import { Schema as S } from 'effect'
import { withLiteralStatics, withStatics } from '../core/statics.js'
import { AbsDir } from './AbsDir.js'
import { AbsFile } from './AbsFile.js'

/**
 * `Abs` — any absolute path (`AbsFile | AbsDir`), as a `string` ⇄ value codec.
 * Carries tagged-union utilities keyed by `_tag`: `cases`, `guards`, `isAnyOf`, `match`.
 */
const AbsTaggedUnion = S.Union([AbsFile, AbsDir]).pipe(S.toTaggedUnion('_tag'))

class Abs_ extends withLiteralStatics(
  withStatics(
    S.asClass(AbsTaggedUnion.pipe(S.overrideToFormatter(() => (path) => path.toString()))),
  ),
) {
  static readonly AbsFile = AbsFile
  static readonly AbsDir = AbsDir
  static readonly cases = AbsTaggedUnion.cases
  static readonly guards = AbsTaggedUnion.guards
  static readonly isAnyOf = AbsTaggedUnion.isAnyOf
  static readonly match = AbsTaggedUnion.match
}

export const Abs = Abs_
export type Abs = typeof Abs_.Type

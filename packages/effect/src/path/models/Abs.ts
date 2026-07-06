import { Schema as S } from 'effect'
import { withLiteralStatics, withStatics } from '../core/statics.js'
import { AbsDir } from './AbsDir.js'
import { AbsFile } from './AbsFile.js'

/**
 * `Abs` — any absolute path (`AbsFile | AbsDir`), as a `string` ⇄ value codec.
 * Carries tagged-union utilities keyed by `_tag`: `cases`, `guards`, `isAnyOf`, `match`.
 */
class Abs_ extends withLiteralStatics(
  withStatics(
    S.asClass(
      S.Union([AbsFile, AbsDir]).pipe(
        S.toTaggedUnion('_tag'),
        S.overrideToFormatter(() => (path) => path.toString()),
      ),
    ),
  ),
) {
  static readonly AbsFile = AbsFile
  static readonly AbsDir = AbsDir
}

export const Abs = Abs_
export type Abs = typeof Abs_.Type

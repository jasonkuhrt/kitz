import { Schema as S } from 'effect'
import { withLiteralStatics, withStatics } from '../core/statics.js'
import { RelDir } from './RelDir.js'
import { RelFile } from './RelFile.js'

/**
 * `Rel` — any relative path (`RelFile | RelDir`), as a `string` ⇄ value codec.
 * Carries tagged-union utilities keyed by `_tag`: `cases`, `guards`, `isAnyOf`, `match`.
 */
class Rel_ extends withLiteralStatics(
  withStatics(
    S.asClass(
      S.Union([RelFile, RelDir]).pipe(
        S.overrideToFormatter(() => (path) => path.toString()),
        S.toTaggedUnion('_tag'),
      ),
    ),
  ),
) {
  static readonly RelFile = RelFile
  static readonly RelDir = RelDir
}

export const Rel = Rel_
export type Rel = typeof Rel_.Type

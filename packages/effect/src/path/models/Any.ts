import { Schema as S } from 'effect'
import { withStatics } from '../../schema/withStatics.js'
import { AbsDir } from './AbsDir.js'
import { AbsFile } from './AbsFile.js'
import { RelDir } from './RelDir.js'
import { RelFile } from './RelFile.js'

/**
 * `Any` — the union schema of all path variants (`AbsFile | AbsDir | RelFile |
 * RelDir`): any possible path, file or directory, absolute or relative.
 *
 * Decodes a string to the appropriate variant instance and encodes back. Carries
 * tagged-union utilities keyed by `_tag`: `cases`, `guards`, `isAnyOf`, `match`.
 *
 * @example
 * ```ts
 * const p1 = S.decodeSync(Any)('/home/user/file.txt')  // AbsFile
 * const p4 = S.decodeSync(Any)('./src/')               // RelDir
 * Any.match(p1, { AbsFile: f => f.name, AbsDir: d => '', RelFile: f => f.name, RelDir: d => '' })
 * ```
 */
const AnyTaggedUnion = S.Union([AbsFile, AbsDir, RelFile, RelDir]).pipe(S.toTaggedUnion('_tag'))

class Any_ extends withStatics(
  AnyTaggedUnion.pipe(S.overrideToFormatter(() => (path) => path.toString())),
) {
  static readonly cases = AnyTaggedUnion.cases
  static readonly guards = AnyTaggedUnion.guards
  static readonly isAnyOf = AnyTaggedUnion.isAnyOf
  static readonly match = AnyTaggedUnion.match
}

export const Any = Any_
export type Any = typeof Any_.Type

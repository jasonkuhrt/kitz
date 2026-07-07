import { Schema as S } from 'effect'
import { withArbitraryHints } from '../../schema/withArbitraryHints.js'
import { withStatics } from '../core/statics.js'
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
  S.asClass(AnyTaggedUnion.pipe(S.overrideToFormatter(() => (path) => path.toString()))),
) {
  static readonly AbsFile = AbsFile
  static readonly AbsDir = AbsDir
  static readonly RelFile = RelFile
  static readonly RelDir = RelDir
  static readonly cases = AnyTaggedUnion.cases
  static readonly guards = AnyTaggedUnion.guards
  static readonly isAnyOf = AnyTaggedUnion.isAnyOf
  static readonly match = AnyTaggedUnion.match

  /**
   * Variant schema carrying a realistic generation bias — same set as the
   * canonical schema; generation mixes the four members' `Realistic` variants
   * 20:1 over the canonical distribution.
   */
  static readonly Realistic = Any_.pipe(
    withArbitraryHints({
      candidate: {
        weight: 20,
        make: (fc) =>
          fc.oneof(
            S.toArbitrary(AbsFile.Realistic),
            S.toArbitrary(AbsDir.Realistic),
            S.toArbitrary(RelFile.Realistic),
            S.toArbitrary(RelDir.Realistic),
          ),
      },
    }),
  )
}

export const Any = Any_
export type Any = typeof Any_.Type

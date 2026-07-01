import { Schema as S } from 'effect'
import { withStatics } from '../core/statics.js'
import { AbsDir } from './AbsDir.js'
import { AbsFile } from './AbsFile.js'
import { RelDir } from './RelDir.js'
import { RelFile } from './RelFile.js'

/**
 * `Any` — the union schema of all path variants (`AbsFile | AbsDir | RelFile |
 * RelDir`): any possible path, file or directory, absolute or relative.
 *
 * Decodes a string to the appropriate variant instance and encodes back to the
 * string form.
 *
 * @example
 * ```ts
 * const p1 = S.decodeSync(Any)('/home/user/file.txt')  // AbsFile
 * const p2 = S.decodeSync(Any)('/home/user/')          // AbsDir
 * const p3 = S.decodeSync(Any)('./src/index.ts')       // RelFile
 * const p4 = S.decodeSync(Any)('./src/')               // RelDir
 * ```
 */
class Any_ extends withStatics(S.asClass(S.Union([AbsFile, AbsDir, RelFile, RelDir]))) {
  static readonly AbsFile = AbsFile
  static readonly AbsDir = AbsDir
  static readonly RelFile = RelFile
  static readonly RelDir = RelDir
}

export const Any = Any_
export type Any = typeof Any_.Type

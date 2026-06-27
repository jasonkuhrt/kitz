import { Schema as S } from 'effect'
import { AbsDir } from './AbsDir.js'
import { AbsFile } from './AbsFile.js'
import { RelDir } from './RelDir.js'
import { RelFile } from './RelFile.js'

/**
 * Union schema of all path types — the complete ADT representing any possible path
 * (file or directory, absolute or relative).
 *
 * Decodes a string to the appropriate variant instance (`AbsFile`, `AbsDir`,
 * `RelFile`, or `RelDir`) and encodes back to the string form.
 *
 * @example
 * ```ts
 * const p1 = S.decodeSync(Path)('/home/user/file.txt')  // AbsFile
 * const p2 = S.decodeSync(Path)('/home/user/')          // AbsDir
 * const p3 = S.decodeSync(Path)('./src/index.ts')       // RelFile
 * const p4 = S.decodeSync(Path)('./src/')               // RelDir
 * ```
 */
class Path_ extends S.asClass(S.Union([AbsFile, AbsDir, RelFile, RelDir])) {
  static readonly AbsFile = AbsFile
  static readonly AbsDir = AbsDir
  static readonly RelFile = RelFile
  static readonly RelDir = RelDir
}

export const Path = Path_
export type Path = typeof Path_.Type

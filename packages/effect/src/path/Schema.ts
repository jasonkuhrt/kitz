import { Schema as S } from 'effect'
import { AbsDir } from './AbsDir/_.js'
import { AbsFile } from './AbsFile/_.js'
import { RelDir } from './RelDir/_.js'
import { RelFile } from './RelFile/_.js'

/**
 * Union schema of all path types — the complete ADT representing any possible path
 * (file or directory, absolute or relative).
 *
 * Decodes a string to the appropriate variant instance (`AbsFile`, `AbsDir`,
 * `RelFile`, or `RelDir`) and encodes back to the string form.
 *
 * @example
 * ```ts
 * const p1 = S.decodeSync(Schema)('/home/user/file.txt')  // AbsFile
 * const p2 = S.decodeSync(Schema)('/home/user/')          // AbsDir
 * const p3 = S.decodeSync(Schema)('./src/index.ts')       // RelFile
 * const p4 = S.decodeSync(Schema)('./src/')               // RelDir
 *
 * const ConfigSchema = S.Struct({ path: Schema })
 * ```
 */
export const Schema = S.Union([AbsFile, AbsDir, RelFile, RelDir]).annotate({
  identifier: 'FsPathAny',
})

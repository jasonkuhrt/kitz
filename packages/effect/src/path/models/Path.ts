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
 * const p1 = S.decodeSync(Schema)('/home/user/file.txt')  // AbsFile
 * const p2 = S.decodeSync(Schema)('/home/user/')          // AbsDir
 * const p3 = S.decodeSync(Schema)('./src/index.ts')       // RelFile
 * const p4 = S.decodeSync(Schema)('./src/')               // RelDir
 *
 * const ConfigSchema = S.Struct({ path: Schema })
 * ```
 */
// Pin to a compact, named codec type so declaration emit references it instead of inlining
// each member's statics intersection (which overflows — TS7056).
export const Path: S.Codec<AbsFile | AbsDir | RelFile | RelDir, string, never, never> = S.Union([
  AbsFile,
  AbsDir,
  RelFile,
  RelDir,
])

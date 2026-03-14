import { Schema as S } from 'effect'
import { AbsDir } from './AbsDir/_.js'
import { AbsFile } from './AbsFile/_.js'
import { RelDir } from './RelDir/_.js'
import { RelFile } from './RelFile/_.js'

// needed to avoid '...canot be naned...' errors

/**
 * Union schema of all path types with string codec baked in.
 * This is the complete ADT representing any possible path (file or directory, absolute or relative).
 *
 * This schema transforms between string representation (e.g., "/home/file.txt", "./src/", etc.)
 * and the appropriate path class instance (AbsFile, AbsDir, RelFile, or RelDir).
 *
 * @example
 * ```ts
 * // Decode from string - auto-detects type
 * const path1 = S.decodeSync(Schema)('/home/user/file.txt')  // AbsFile
 * const path2 = S.decodeSync(Schema)('/home/user/')          // AbsDir
 * const path3 = S.decodeSync(Schema)('./src/index.ts')       // RelFile
 * const path4 = S.decodeSync(Schema)('./src/')               // RelDir
 *
 * // Use in struct (expects string input)
 * const ConfigSchema = S.Struct({
 *   path: Schema
 * })
 * ```
 */
export const Schema = S.Union([
  AbsFile.Schema,
  AbsDir.Schema,
  RelFile.Schema,
  RelDir.Schema,
]).annotate({
  identifier: 'FsPathAny',
})

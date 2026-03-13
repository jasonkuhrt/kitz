import { Schema as S } from 'effect'
import { AbsDir } from '../AbsDir/_.js'
import { RelDir } from '../RelDir/_.js'

// needed to avoid '...canot be naned...' errors

/**
 * Union schema of all directory path types with string codec baked in.
 * Includes both absolute and relative directories.
 *
 * This schema transforms between string representation (e.g., "/home/user/" or "./src/")
 * and the appropriate AbsDir or RelDir class instance.
 *
 * @example
 * ```ts
 * // Decode from string - auto-detects absolute vs relative
 * const path1 = S.decodeSync($Dir.Schema)('/home/user/')  // AbsDir
 * const path2 = S.decodeSync($Dir.Schema)('./src/')       // RelDir
 *
 * // Use in struct (expects string input)
 * const ConfigSchema = S.Struct({
 *   dir: $Dir.Schema
 * })
 * ```
 */
export const Schema = S.Union([AbsDir.Schema, RelDir.Schema]).annotate({
  identifier: '$Dir',
})

/**
 * Type guard to check if a value is a directory path.
 */
export const is = S.is(Schema)

import { Schema as S } from 'effect'
import { RelDir } from '../RelDir/_.js'
import { RelFile } from '../RelFile/_.js'

/**
 * Union schema of all relative path types with string codec baked in.
 * Includes both relative files and relative directories.
 *
 * This schema transforms between string representation (e.g., "./file.txt" or "./src/")
 * and the appropriate RelFile or RelDir class instance.
 *
 * @example
 * ```ts
 * // Decode from string - auto-detects file vs directory
 * const path1 = S.decodeSync($Rel.Schema)('./file.txt')  // RelFile
 * const path2 = S.decodeSync($Rel.Schema)('./src/')      // RelDir
 *
 * // Use in struct (expects string input)
 * const ConfigSchema = S.Struct({
 *   path: $Rel.Schema
 * })
 * ```
 */
export const Schema = S.Union([RelFile.Schema, RelDir.Schema]).annotate({
  identifier: '$Rel',
})

/**
 * Type guard to check if a value is a relative path.
 */
export const is = S.is(Schema)

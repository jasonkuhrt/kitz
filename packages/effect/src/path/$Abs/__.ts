import { Schema as S } from 'effect'
import { AbsDir } from '../AbsDir/_.js'
import { AbsFile } from '../AbsFile/_.js'

// needed to avoid '...canot be naned...' errors

/**
 * Union schema of all absolute path types with string codec baked in.
 * Includes both absolute files and absolute directories.
 *
 * This schema transforms between string representation (e.g., "/home/user/file.txt" or "/home/user/")
 * and the appropriate AbsFile or AbsDir class instance.
 *
 * @example
 * ```ts
 * // Decode from string - auto-detects file vs directory
 * const path1 = S.decodeSync($Abs.Schema)('/home/user/file.txt')  // AbsFile
 * const path2 = S.decodeSync($Abs.Schema)('/home/user/')          // AbsDir
 *
 * // Use in struct (expects string input)
 * const ConfigSchema = S.Struct({
 *   path: $Abs.Schema
 * })
 * ```
 */
export const Schema = S.Union([AbsFile.Schema, AbsDir.Schema]).annotate({
  identifier: '$Abs',
})

/**
 * Type guard to check if a value is an absolute path.
 */
export const is = S.is(Schema)

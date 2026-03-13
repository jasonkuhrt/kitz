import { Schema as S } from 'effect'
import { AbsFile } from '../AbsFile/_.js'
import { RelFile } from '../RelFile/_.js'

/**
 * Union schema of all file path types with string codec baked in.
 * Includes both absolute and relative files.
 *
 * This schema transforms between string representation (e.g., "/home/file.txt" or "./file.txt")
 * and the appropriate AbsFile or RelFile class instance.
 *
 * @example
 * ```ts
 * // Decode from string - auto-detects absolute vs relative
 * const path1 = S.decodeSync($File.Schema)('/home/file.txt')  // AbsFile
 * const path2 = S.decodeSync($File.Schema)('./file.txt')      // RelFile
 *
 * // Use in struct (expects string input)
 * const ConfigSchema = S.Struct({
 *   file: $File.Schema
 * })
 * ```
 */
export const Schema = S.Union([AbsFile.Schema, RelFile.Schema]).annotate({
  identifier: '$File',
})

/**
 * Type guard to check if a value is a file path.
 */
export const is = S.is(Schema)
